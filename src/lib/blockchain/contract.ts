import {
	Contract,
	FallbackProvider,
	JsonRpcProvider,
	Network,
	NonceManager,
	Wallet,
} from 'ethers'
import AgreementContractArtifact from '../../contract/AgreementContract.json'
import type {
	ContractTransactionReceipt,
	ContractTransactionResponse,
	Log,
	LogDescription,
} from 'ethers'

const RPC_URL = process.env.RPC_URL
const RPC_URL_FALLBACK = process.env.RPC_URL_FALLBACK
const CHAIN_ID = Number(process.env.CHAIN_ID || 84532)
const CHAIN_NAME = process.env.CHAIN_NAME || 'base-sepolia'
const PRIVATE_KEY = process.env.PRIVATE_KEY
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
const METADATA_BASE_URI = process.env.AGREEMENT_METADATA_BASE_URI || 'wemsp://agreement'
const EXPLORER_TX_BASE = process.env.BLOCK_EXPLORER_TX_BASE || 'https://sepolia.basescan.org/tx'
const EXPLORER_ADDRESS_BASE =
	process.env.BLOCK_EXPLORER_ADDRESS_BASE || 'https://sepolia.basescan.org/address'

const RETRY_LIMIT = Number(process.env.ONCHAIN_RETRY_LIMIT || 4)
const RETRY_BASE_DELAY_MS = Number(process.env.ONCHAIN_RETRY_BASE_DELAY_MS || 500)

// Errors that can succeed on retry: RPC timeouts, DNS/connection failures,
// transient server errors and rate limits. Contract reverts are NOT included.
const RETRYABLE_ERROR_CODES = new Set(['TIMEOUT', 'NETWORK_ERROR', 'SERVER_ERROR', 'BAD_DATA'])
const RETRYABLE_ERROR_PATTERNS = [
	/EAI_AGAIN/i,
	/ENOTFOUND/i,
	/ECONNRESET/i,
	/ECONNREFUSED/i,
	/ETIMEDOUT/i,
	/ESOCKETTIMEDOUT/i,
	/socket hang up/i,
	/fetch failed/i,
	/request timeout/i,
	/rate limit/i,
	/too many requests/i,
	/\b429\b/,
	/\b5\d\d\b/,
]

let _provider: FallbackProvider | null = null
let _wallet: Wallet | null = null
let _signer: NonceManager | null = null
let _contract: Contract | null = null

export interface MintResult {
	tokenId: number
	txHash: string
	blockNumber: number
}

export interface SignatureResult {
	txHash: string
	blockNumber: number
	timestamp: number
}

export interface EnsureMintedResult {
	tokenId: number
	wasMinted: boolean
	mintResult?: MintResult
}

export interface AgreementData {
	agreementId: string
	beneficiaryIds: Array<string>
	beneficiaryCount: number
	signedCount: number
	ownerSigned: boolean
	ownerSignedAt: number
	witnessSigned: boolean
	witnessedAt: number
	isFinalized: boolean
}

export interface BeneficiarySignatureStatus {
	hasSigned: boolean
	signedAt: number
}

/**
 * Build a resilient provider over the primary RPC (and an optional fallback).
 * The FallbackProvider broadcasts transactions to every backend and uses the
 * first successful response, and reads race providers with quorum 1, so a
 * slow or failing RPC does not block an operation.
 */
function getProvider(): FallbackProvider {
	if (!RPC_URL) {
		throw new Error('RPC_URL environment variable is not set')
	}
	if (!_provider) {
		const staticNetwork = new Network(CHAIN_NAME, CHAIN_ID)
		const providers: Array<{ provider: JsonRpcProvider; weight: number }> = [
			{ provider: new JsonRpcProvider(RPC_URL, staticNetwork, { pollingInterval: 4000 }), weight: 2 },
		]
		if (RPC_URL_FALLBACK) {
			providers.push({
				provider: new JsonRpcProvider(RPC_URL_FALLBACK, staticNetwork, { pollingInterval: 4000 }),
				weight: 1,
			})
		}
		_provider = new FallbackProvider(providers, staticNetwork, { quorum: 1 })
	}
	return _provider
}

function getWallet(): Wallet {
	if (!PRIVATE_KEY) {
		throw new Error('PRIVATE_KEY environment variable is not set')
	}
	if (!_wallet) {
		_wallet = new Wallet(PRIVATE_KEY, getProvider())
	}
	return _wallet
}

function getSigner(): NonceManager {
	if (!_signer) {
		_signer = new NonceManager(getWallet())
	}
	return _signer
}

function getContract(): Contract {
	if (!CONTRACT_ADDRESS) {
		throw new Error('CONTRACT_ADDRESS environment variable is not set')
	}
	if (!_contract) {
		_contract = new Contract(CONTRACT_ADDRESS, AgreementContractArtifact.abi, getSigner())
	}
	return _contract
}

export function isTransientError(error: unknown): boolean {
	if (!error) return false
	const candidate = error as { code?: unknown; message?: string; shortMessage?: string }
	if (typeof candidate.code === 'string' && RETRYABLE_ERROR_CODES.has(candidate.code)) {
		return true
	}
	const message = `${candidate.message || ''} ${candidate.shortMessage || ''}`
	return RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(
	operation: () => Promise<T>,
	options: { onRetry?: () => void } = {},
): Promise<T> {
	let attempt = 0
	for (;;) {
		try {
			return await operation()
		} catch (error) {
			if (attempt >= RETRY_LIMIT || !isTransientError(error)) {
				throw error
			}
			attempt++
			const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 200)
			console.warn(
				`[onchain] transient RPC error, retrying (${attempt}/${RETRY_LIMIT}): ${getErrorMessage(error)}`,
			)
			options.onRetry?.()
			await sleep(delay)
		}
	}
}

/**
 * Submit a write transaction and confirm it. The tx hash is captured as soon
 * as the broadcast returns; if the broadcast itself times out, the signer
 * nonce is reloaded from the chain and the send is retried (safe: contract
 * calls are idempotent and duplicates revert). If only the confirmation
 * times out, the receipt is polled directly.
 */
async function sendAndConfirmReceipt(
	operation: () => Promise<ContractTransactionResponse>,
): Promise<{ receipt: ContractTransactionReceipt; txHash: string }> {
	let tx: ContractTransactionResponse
	try {
		tx = await withRetry(() => operation(), {
			onRetry: () => {
				try {
					getSigner().reset()
				} catch {
					// ignore nonce reset failures
				}
			},
		})
	} catch (error) {
		try {
			getSigner().reset()
		} catch {
			// ignore nonce reset failures
		}
		throw error
	}
	const receipt = await waitForReceipt(tx)
	return { receipt, txHash: receipt.hash }
}

async function waitForReceipt(
	tx: ContractTransactionResponse,
): Promise<ContractTransactionReceipt> {
	try {
		return await tx.wait()
	} catch (error) {
		if (!isTransientError(error)) {
			throw error
		}
		return pollForReceipt(tx.hash)
	}
}

async function pollForReceipt(txHash: string): Promise<ContractTransactionReceipt> {
	const provider = getProvider()
	let attempt = 0
	const maxAttempts = 12
	for (;;) {
		const receipt = await withRetry(() => provider.getTransactionReceipt(txHash))
		if (receipt) {
			return receipt
		}
		const pending = await provider.getTransaction(txHash).catch(() => null)
		if (attempt >= maxAttempts || !pending) {
			throw new Error(`Transaction ${txHash} not confirmed within retry window`)
		}
		attempt++
		await sleep(RETRY_BASE_DELAY_MS * 2 * attempt)
	}
}

async function signatureResultFromReceipt(
	receipt: ContractTransactionReceipt,
): Promise<SignatureResult> {
	const block = await withRetry(() => getProvider().getBlock(receipt.blockNumber))
	return {
		txHash: receipt.hash,
		blockNumber: receipt.blockNumber,
		timestamp: block?.timestamp ?? Math.floor(Date.now() / 1000),
	}
}

function getErrorMessage(error: unknown): string {
	if (!error) return 'Unknown error'
	if (typeof error === 'string') return error
	if (typeof error === 'object') {
		const e = error as {
			message?: string
			shortMessage?: string
			info?: { errorName?: string; error?: { message?: string } }
		}
		return e.shortMessage || e.info?.errorName || e.info?.error?.message || e.message || 'Unknown error'
	}
	return String(error)
}

function isAgreementAlreadyMintedError(error: unknown): boolean {
	const message = getErrorMessage(error)
	return message.includes('AgreementIdAlreadyExists')
}

function getTimestampDate(timestamp: number | null | undefined): Date {
	const safeTimestamp = timestamp && timestamp > 0 ? timestamp : Math.floor(Date.now() / 1000)
	return new Date(safeTimestamp * 1000)
}

export function getContractAddress(): string {
	if (!CONTRACT_ADDRESS) {
		throw new Error('CONTRACT_ADDRESS environment variable is not set')
	}
	return CONTRACT_ADDRESS
}

export function buildAgreementMetadataUri(agreementId: string): string {
	const base = METADATA_BASE_URI.replace(/\/+$/, '')
	return `${base}/${encodeURIComponent(agreementId)}`
}

export async function mintAgreementNFT(
	agreementId: string,
	metadataUri: string,
	beneficiaryIds: Array<string>
): Promise<MintResult> {
	const contract = getContract()
	const { receipt } = await sendAndConfirmReceipt(() =>
		contract.mintAgreement(agreementId, metadataUri, beneficiaryIds),
	)

	const mintEvent = receipt.logs
		.map((log: Log) => {
			try {
				return contract.interface.parseLog({
					topics: [...log.topics],
					data: log.data,
				})
			} catch {
				return null
			}
		})
		.find((event: LogDescription | null) => event?.name === 'AgreementMinted')

	if (!mintEvent) {
		throw new Error('AgreementMinted event not found in transaction receipt')
	}

	return {
		tokenId: Number(mintEvent.args.tokenId),
		txHash: receipt.hash,
		blockNumber: receipt.blockNumber,
	}
}

export async function ensureAgreementMinted(
	agreementId: string,
	beneficiaryIds: Array<string>,
	metadataUri?: string
): Promise<EnsureMintedResult> {
	const existingTokenId = await getTokenIdByAgreementId(agreementId)
	if (existingTokenId > 0) {
		return {
			tokenId: existingTokenId,
			wasMinted: false,
		}
	}

	const uri = metadataUri || buildAgreementMetadataUri(agreementId)

	try {
		const mintResult = await mintAgreementNFT(agreementId, uri, beneficiaryIds)
		return {
			tokenId: mintResult.tokenId,
			wasMinted: true,
			mintResult,
		}
	} catch (error) {
		if (isAgreementAlreadyMintedError(error)) {
			const tokenId = await getTokenIdByAgreementId(agreementId)
			if (tokenId > 0) {
				return {
					tokenId,
					wasMinted: false,
				}
			}
		}
		throw error
	}
}

export async function recordOwnerSignature(tokenId: number): Promise<SignatureResult> {
	const contract = getContract()
	const { receipt } = await sendAndConfirmReceipt(() => contract.recordOwnerSignature(tokenId))
	return signatureResultFromReceipt(receipt)
}

export async function recordBeneficiarySignature(
	tokenId: number,
	beneficiaryId: string
): Promise<SignatureResult> {
	const contract = getContract()
	const { receipt } = await sendAndConfirmReceipt(() =>
		contract.recordBeneficiarySignature(tokenId, beneficiaryId),
	)
	return signatureResultFromReceipt(receipt)
}

export async function recordWitnessSignature(tokenId: number): Promise<SignatureResult> {
	const contract = getContract()
	const { receipt } = await sendAndConfirmReceipt(() => contract.recordWitnessSignature(tokenId))
	return signatureResultFromReceipt(receipt)
}

export async function finalizeAgreement(tokenId: number): Promise<SignatureResult> {
	const contract = getContract()
	const { receipt } = await sendAndConfirmReceipt(() => contract.finalizeAgreement(tokenId))
	return signatureResultFromReceipt(receipt)
}

export async function updateAgreementMetadata(
	tokenId: number,
	metadataUri: string
): Promise<SignatureResult> {
	const contract = getContract()
	const { receipt } = await sendAndConfirmReceipt(() =>
		contract.updateAgreement(tokenId, metadataUri),
	)
	return signatureResultFromReceipt(receipt)
}

export async function getAgreementData(tokenId: number): Promise<AgreementData> {
	const contract = getContract()
	const data = await withRetry(() => contract.getAgreement(tokenId))

	return {
		agreementId: data.agreementId,
		beneficiaryIds: [...data.beneficiaryIds],
		beneficiaryCount: Number(data.beneficiaryCount),
		signedCount: Number(data.signedCount),
		ownerSigned: data.ownerSigned,
		ownerSignedAt: Number(data.ownerSignedAt),
		witnessSigned: data.witnessSigned,
		witnessedAt: Number(data.witnessedAt),
		isFinalized: data.isFinalized,
	}
}

export async function getBeneficiarySignatureStatus(
	tokenId: number,
	beneficiaryId: string
): Promise<BeneficiarySignatureStatus> {
	const contract = getContract()
	const [hasSigned, signedAt] = await withRetry(() =>
		contract.getBeneficiarySignature(tokenId, beneficiaryId),
	)

	return {
		hasSigned,
		signedAt: Number(signedAt),
	}
}

export async function isAgreementFullySigned(tokenId: number): Promise<boolean> {
	const contract = getContract()
	return withRetry(() => contract.isFullySigned(tokenId))
}

export async function getTokenIdByAgreementId(agreementId: string): Promise<number> {
	const contract = getContract()
	const tokenId = await withRetry(() => contract.getTokenIdByAgreementId(agreementId))
	return Number(tokenId)
}

export async function getTokenIdByVisibleId(visibleId: string): Promise<number> {
	return getTokenIdByAgreementId(visibleId)
}

export async function getTokenURI(tokenId: number): Promise<string> {
	const contract = getContract()
	return withRetry(() => contract.tokenURI(tokenId))
}

export async function getTotalSupply(): Promise<number> {
	const contract = getContract()
	const supply = await withRetry(() => contract.totalSupply())
	return Number(supply)
}

export function getExplorerUrl(txHash: string): string {
	return `${EXPLORER_TX_BASE}/${txHash}`
}

export function getContractExplorerUrl(): string {
	return `${EXPLORER_ADDRESS_BASE}/${getContractAddress()}`
}

export function isContractConfigured(): boolean {
	return Boolean(RPC_URL && PRIVATE_KEY && CONTRACT_ADDRESS)
}

export function getWalletAddress(): string {
	return getWallet().address
}

export { getErrorMessage as getOnChainErrorMessage, getTimestampDate as getOnChainTimestampDate }
