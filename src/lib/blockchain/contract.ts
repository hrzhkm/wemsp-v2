import { Contract, JsonRpcProvider, NonceManager, Wallet } from 'ethers'
import AgreementContractArtifact from '../../contract/AgreementContract.json'
import type { Log, LogDescription } from 'ethers'

const RPC_URL = process.env.RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
const METADATA_BASE_URI = process.env.AGREEMENT_METADATA_BASE_URI || 'wemsp://agreement'
const EXPLORER_TX_BASE = process.env.BLOCK_EXPLORER_TX_BASE || 'https://sepolia.basescan.org/tx'
const EXPLORER_ADDRESS_BASE =
	process.env.BLOCK_EXPLORER_ADDRESS_BASE || 'https://sepolia.basescan.org/address'

let _provider: JsonRpcProvider | null = null
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

function getProvider(): JsonRpcProvider {
	if (!RPC_URL) {
		throw new Error('RPC_URL environment variable is not set')
	}
	if (!_provider) {
		_provider = new JsonRpcProvider(RPC_URL)
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
	const tx = await contract.mintAgreement(agreementId, metadataUri, beneficiaryIds)
	const receipt = await tx.wait()

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
	const tx = await contract.recordOwnerSignature(tokenId)
	const receipt = await tx.wait()
	const block = await getProvider().getBlock(receipt.blockNumber)

	return {
		txHash: receipt.hash,
		blockNumber: receipt.blockNumber,
		timestamp: block?.timestamp ?? Math.floor(Date.now() / 1000),
	}
}

export async function recordBeneficiarySignature(
	tokenId: number,
	beneficiaryId: string
): Promise<SignatureResult> {
	const contract = getContract()
	const tx = await contract.recordBeneficiarySignature(tokenId, beneficiaryId)
	const receipt = await tx.wait()
	const block = await getProvider().getBlock(receipt.blockNumber)

	return {
		txHash: receipt.hash,
		blockNumber: receipt.blockNumber,
		timestamp: block?.timestamp ?? Math.floor(Date.now() / 1000),
	}
}

export async function recordWitnessSignature(tokenId: number): Promise<SignatureResult> {
	const contract = getContract()
	const tx = await contract.recordWitnessSignature(tokenId)
	const receipt = await tx.wait()
	const block = await getProvider().getBlock(receipt.blockNumber)

	return {
		txHash: receipt.hash,
		blockNumber: receipt.blockNumber,
		timestamp: block?.timestamp ?? Math.floor(Date.now() / 1000),
	}
}

export async function finalizeAgreement(tokenId: number): Promise<SignatureResult> {
	const contract = getContract()
	const tx = await contract.finalizeAgreement(tokenId)
	const receipt = await tx.wait()
	const block = await getProvider().getBlock(receipt.blockNumber)

	return {
		txHash: receipt.hash,
		blockNumber: receipt.blockNumber,
		timestamp: block?.timestamp ?? Math.floor(Date.now() / 1000),
	}
}

export async function updateAgreementMetadata(
	tokenId: number,
	metadataUri: string
): Promise<SignatureResult> {
	const contract = getContract()
	const tx = await contract.updateAgreement(tokenId, metadataUri)
	const receipt = await tx.wait()
	const block = await getProvider().getBlock(receipt.blockNumber)

	return {
		txHash: receipt.hash,
		blockNumber: receipt.blockNumber,
		timestamp: block?.timestamp ?? Math.floor(Date.now() / 1000),
	}
}

export async function getAgreementData(tokenId: number): Promise<AgreementData> {
	const contract = getContract()
	const data = await contract.getAgreement(tokenId)

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
	const [hasSigned, signedAt] = await contract.getBeneficiarySignature(tokenId, beneficiaryId)

	return {
		hasSigned,
		signedAt: Number(signedAt),
	}
}

export async function isAgreementFullySigned(tokenId: number): Promise<boolean> {
	const contract = getContract()
	return contract.isFullySigned(tokenId)
}

export async function getTokenIdByAgreementId(agreementId: string): Promise<number> {
	const contract = getContract()
	const tokenId = await contract.getTokenIdByAgreementId(agreementId)
	return Number(tokenId)
}

export async function getTokenIdByVisibleId(visibleId: string): Promise<number> {
	return getTokenIdByAgreementId(visibleId)
}

export async function getTokenURI(tokenId: number): Promise<string> {
	const contract = getContract()
	return contract.tokenURI(tokenId)
}

export async function getTotalSupply(): Promise<number> {
	const contract = getContract()
	const supply = await contract.totalSupply()
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
