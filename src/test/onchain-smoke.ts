import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
  const {
    ensureAgreementMinted,
    getAgreementData,
    getTokenIdByAgreementId,
    isAgreementFullySigned,
    recordBeneficiarySignature,
    recordOwnerSignature,
    recordWitnessSignature,
    finalizeAgreement,
  } = await import('@/lib/blockchain/contract')
  const agreementId = `smoke-${Date.now()}`
  const beneficiaries = ['101', '102']

  const minted = await ensureAgreementMinted(agreementId, beneficiaries)
  console.log('minted:', minted)

  const tokenId = await getTokenIdByAgreementId(agreementId)
  if (!tokenId) throw new Error('Token was not created')

  await recordOwnerSignature(tokenId)
  await recordBeneficiarySignature(tokenId, beneficiaries[0])
  await recordBeneficiarySignature(tokenId, beneficiaries[1])
  await recordWitnessSignature(tokenId)

  const fullySigned = await isAgreementFullySigned(tokenId)
  console.log('fullySigned:', fullySigned)
  if (!fullySigned) throw new Error('Agreement not fully signed')

  await finalizeAgreement(tokenId)

  const data = await getAgreementData(tokenId)
  console.log('final:', {
    tokenId,
    ownerSigned: data.ownerSigned,
    signedCount: data.signedCount,
    beneficiaryCount: data.beneficiaryCount,
    witnessSigned: data.witnessSigned,
    isFinalized: data.isFinalized,
  })

  if (!data.isFinalized) throw new Error('Agreement was not finalized')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
