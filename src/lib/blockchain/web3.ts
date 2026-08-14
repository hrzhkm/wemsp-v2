import { ethers } from 'ethers'
import { CONTRACT_ADDRESS } from './config'
import ContractABI from '@/contract/AgreementContract.json'

export function getBrowserProvider() {
	if (typeof window === 'undefined') {
		return null
	}
	const ethereum = (window as Window & { ethereum?: ethers.Eip1193Provider }).ethereum
	if (!ethereum) {
		return null
	}
	return new ethers.BrowserProvider(ethereum)
}

export function getReadOnlyContract(provider: ethers.Provider) {
	if (!CONTRACT_ADDRESS) {
		throw new Error('Contract address is not configured')
	}
	return new ethers.Contract(CONTRACT_ADDRESS, ContractABI.abi, provider)
}
