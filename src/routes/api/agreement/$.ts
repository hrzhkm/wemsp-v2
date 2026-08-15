import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import { DistributionType } from '@/generated/prisma/enums'
import {
  ensureAgreementMintedWithMetadata,
  refreshAgreementMetadataUri,
} from '@/lib/agreement/agreementMetadata'
import {
  getExplorerUrl,
  isContractConfigured,
  updateAgreementMetadata,
} from '@/lib/blockchain/contract'
import {
  canEditAgreement,
  validateAgreementInput,
  validateAssets,
  validateBeneficiaries,
} from '@/lib/agreement/agreementValidation'

export const agreementHandlers = {
      // GET /api/agreement - List agreements or get single agreement by ID
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const pathParts = url.pathname.split('/')
          const idParam = pathParts[pathParts.length - 1]

          // If ID is present (not 'agreement'), fetch single agreement
          if (idParam !== 'agreement') {
            const agreement = await prisma.agreement.findFirst({
              where: {
                id: idParam,
                OR: [
                  // User is the owner
                  { ownerId: session.user.id },
                  // User is a beneficiary (through registered family member)
                  {
                    beneficiaries: {
                      some: {
                        familyMember: {
                          familyMemberUserId: session.user.id,
                        },
                      },
                    },
                  },
                ],
              },
              include: {
                owner: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                assets: {
                  include: {
                    asset: true,
                  },
                },
                beneficiaries: {
                  include: {
                    familyMember: {
                      include: {
                        familyMemberUser: {
                          select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
                          },
                        },
                      },
                    },
                    nonRegisteredFamilyMember: true,
                  },
                },
                witness: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            })

            if (!agreement) {
              return Response.json(
                { error: 'Agreement not found' },
                { status: 404 }
              )
            }

            // Transform for response
            const transformedAgreement = {
              id: agreement.id,
              title: agreement.title,
              description: agreement.description,
              distributionType: agreement.distributionType,
              status: agreement.status,
              effectiveDate: agreement.effectiveDate?.toISOString(),
              expiryDate: agreement.expiryDate?.toISOString(),
              createdAt: agreement.createdAt.toISOString(),
              updatedAt: agreement.updatedAt.toISOString(),
              owner: {
                id: agreement.owner.id,
                name: agreement.owner.name,
                email: agreement.owner.email,
              },
              ownerSignature: {
                hasSigned: agreement.ownerHasSigned,
                signedAt: agreement.ownerSignedAt?.toISOString(),
                txHash: agreement.ownerSignatureRef,
                explorerUrl: agreement.ownerSignatureRef
                  ? getExplorerUrl(agreement.ownerSignatureRef)
                  : null,
              },
              witness: agreement.witness
                ? {
                    id: agreement.witness.id,
                    name: agreement.witness.name,
                    email: agreement.witness.email,
                  }
                : null,
              witnessedAt: agreement.witnessedAt?.toISOString(),
              assets: agreement.assets.map((aa) => ({
                id: aa.id,
                allocatedValue: aa.allocatedValue,
                allocatedPercentage: aa.allocatedPercentage,
                notes: aa.notes,
                asset: {
                  id: aa.asset.id,
                  name: aa.asset.name,
                  type: aa.asset.type,
                  description: aa.asset.description,
                  value: aa.asset.value,
                  documentUrl: aa.asset.documentUrl,
                },
              })),
              beneficiaries: agreement.beneficiaries.map((ab) => ({
                id: ab.id,
                sharePercentage: ab.sharePercentage,
                shareDescription: ab.shareDescription,
                hasSigned: ab.hasSigned,
                signedAt: ab.signedAt?.toISOString(),
                signatureRef: ab.signatureRef,
                explorerUrl: ab.signatureRef ? getExplorerUrl(ab.signatureRef) : null,
                isAccepted: ab.isAccepted,
                rejectionReason: ab.rejectionReason,
                familyMember: ab.familyMember
                  ? {
                      id: ab.familyMember.id,
                      relation: ab.familyMember.relation,
                      user: {
                        id: ab.familyMember.familyMemberUser.id,
                        name: ab.familyMember.familyMemberUser.name,
                        email: ab.familyMember.familyMemberUser.email,
                        image: ab.familyMember.familyMemberUser.image,
                      },
                    }
                  : null,
                nonRegisteredFamilyMember: ab.nonRegisteredFamilyMember
                  ? {
                      id: ab.nonRegisteredFamilyMember.id,
                      name: ab.nonRegisteredFamilyMember.name,
                      icNumber: ab.nonRegisteredFamilyMember.icNumber,
                      relation: ab.nonRegisteredFamilyMember.relation,
                      phoneNumber: ab.nonRegisteredFamilyMember.phoneNumber,
                      address: ab.nonRegisteredFamilyMember.address,
                    }
                  : null,
              })),
            }

            return Response.json({ agreement: transformedAgreement })
          }

          // List agreements
          const agreements = await prisma.agreement.findMany({
            where: {
              OR: [
                // User is the owner
                { ownerId: session.user.id },
                // User is a beneficiary (through registered family member)
                {
                  beneficiaries: {
                    some: {
                      familyMember: {
                        familyMemberUserId: session.user.id,
                      },
                    },
                  },
                },
              ],
            },
            include: {
              _count: {
                select: {
                  assets: true,
                  beneficiaries: true,
                },
              },
              assets: {
                select: {
                  assetId: true,
                },
              },
              beneficiaries: {
                include: {
                  familyMember: {
                    select: {
                      familyMemberUserId: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })

          // Get signature counts and user role for each agreement
          const agreementsWithStats = await Promise.all(
            agreements.map(async (agreement) => {
              const signedBeneficiaries = await prisma.agreementBeneficiary.count({
                where: {
                  agreementId: agreement.id,
                  hasSigned: true,
                },
              })

              // Determine user's role in this agreement
              const isOwner = agreement.ownerId === session.user.id
              const isBeneficiary = agreement.beneficiaries.some(
                (b) => b.familyMember?.familyMemberUserId === session.user.id
              )

              return {
                id: agreement.id,
                title: agreement.title,
                description: agreement.description,
                distributionType: agreement.distributionType,
                status: agreement.status,
                effectiveDate: agreement.effectiveDate?.toISOString(),
                expiryDate: agreement.expiryDate?.toISOString(),
                createdAt: agreement.createdAt.toISOString(),
                updatedAt: agreement.updatedAt.toISOString(),
                ownerHasSigned: agreement.ownerHasSigned,
                witnessedAt: agreement.witnessedAt?.toISOString(),
                assetCount: agreement._count.assets,
                beneficiaryCount: agreement._count.beneficiaries,
                signedBeneficiaryCount: signedBeneficiaries,
                isOwner,
                isBeneficiary,
                assets: agreement.assets.map((a: any) => ({ assetId: a.assetId })),
              }
            })
          )

          return Response.json({ agreements: agreementsWithStats })
        } catch (error) {
          console.error('Error fetching agreements:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },

      // POST /api/agreement - Create new agreement
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const body = await request.json()
          const {
            title,
            description,
            distributionType,
            effectiveDate,
            expiryDate,
            assets,
            beneficiaries,
          } = body

          // Validate basic input
          const basicValidation = validateAgreementInput({
            title,
            description,
            distributionType,
            effectiveDate,
            expiryDate,
          })

          if (!basicValidation.valid) {
            return Response.json(
              { error: 'Validation failed', details: basicValidation.errors },
              { status: 400 }
            )
          }

          // Validate distribution type
          if (!distributionType || !Object.values(DistributionType).includes(distributionType)) {
            return Response.json(
              { error: 'Invalid distribution type' },
              { status: 400 }
            )
          }

          // Validate beneficiaries
          const beneficiaryValidation = validateBeneficiaries(
            beneficiaries || [],
            distributionType
          )

          if (!beneficiaryValidation.valid) {
            return Response.json(
              { error: 'Beneficiary validation failed', details: beneficiaryValidation.errors },
              { status: 400 }
            )
          }

          // Validate assets
          const assetValidation = validateAssets(assets || [])

          if (!assetValidation.valid) {
            return Response.json(
              { error: 'Asset validation failed', details: assetValidation.errors },
              { status: 400 }
            )
          }

          // Verify all assets belong to the user
          const assetIds = (assets || []).map((a: any) => a.assetId)
          const userAssets = await prisma.asset.findMany({
            where: {
              id: { in: assetIds },
              userId: session.user.id,
            },
          })

          if (userAssets.length !== assetIds.length) {
            return Response.json(
              { error: 'One or more assets do not belong to you' },
              { status: 403 }
            )
          }

          // Verify beneficiaries belong to user's family
          for (const beneficiary of beneficiaries || []) {
            if (beneficiary.familyMemberId) {
              const familyMember = await prisma.familyMember.findFirst({
                where: {
                  id: beneficiary.familyMemberId,
                  userId: session.user.id,
                },
              })

              if (!familyMember) {
                return Response.json(
                  { error: `Family member ${beneficiary.familyMemberId} not found in your family` },
                  { status: 404 }
                )
              }
            } else if (beneficiary.nonRegisteredFamilyMemberId) {
              const nonRegMember = await prisma.nonRegisteredFamilyMember.findFirst({
                where: {
                  id: beneficiary.nonRegisteredFamilyMemberId,
                  userId: session.user.id,
                },
              })

              if (!nonRegMember) {
                return Response.json(
                  { error: `Non-registered family member ${beneficiary.nonRegisteredFamilyMemberId} not found` },
                  { status: 404 }
                )
              }
            }
          }

          // Create agreement in transaction
          const beneficiaryIds: Array<string> = []
          const agreement = await prisma.$transaction(async (tx) => {
            // Create agreement
            const newAgreement = await tx.agreement.create({
              data: {
                title,
                description,
                distributionType,
                ownerId: session.user.id,
                effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
              },
            })

            // Add assets
            if (assets && assets.length > 0) {
              await tx.agreementAsset.createMany({
                data: assets.map((a: any) => ({
                  agreementId: newAgreement.id,
                  assetId: a.assetId,
                  allocatedValue: a.allocatedValue,
                  allocatedPercentage: a.allocatedPercentage,
                  notes: a.notes,
                })),
              })
            }

            // Add beneficiaries
            if (beneficiaries && beneficiaries.length > 0) {
              for (const beneficiary of beneficiaries) {
                const created = await tx.agreementBeneficiary.create({
                  data: {
                    agreementId: newAgreement.id,
                    familyMemberId: beneficiary.familyMemberId,
                    nonRegisteredFamilyMemberId: beneficiary.nonRegisteredFamilyMemberId,
                    sharePercentage: beneficiary.sharePercentage,
                    shareDescription: beneficiary.shareDescription,
                  },
                  select: { id: true },
                })
                beneficiaryIds.push(created.id)
              }
            }

            return newAgreement
          })

          // Mint the agreement NFT at creation (best-effort; lazy mint at first
          // signature remains as a fallback when the contract is not configured)
          let onChain: {
            tokenId: number
            mintTxHash: string | null
            mintExplorerUrl: string | null
          } | null = null

          if (isContractConfigured() && beneficiaryIds.length > 0) {
            try {
              const mintResult = await ensureAgreementMintedWithMetadata(
                agreement.id,
                beneficiaryIds,
              )
              onChain = {
                tokenId: mintResult.tokenId,
                mintTxHash: mintResult.mintResult?.txHash || null,
                mintExplorerUrl: mintResult.mintResult?.txHash
                  ? getExplorerUrl(mintResult.mintResult.txHash)
                  : null,
              }
            } catch (mintError) {
              console.error('Error minting agreement NFT at creation:', mintError)
            }
          }

          return Response.json({
            success: true,
            agreement: {
              id: agreement.id,
              title: agreement.title,
              status: agreement.status,
            },
            onChain,
          }, { status: 201 })
        } catch (error) {
          console.error('Error creating agreement:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },

      // PUT /api/agreement - Update agreement
      PUT: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const pathParts = url.pathname.split('/')
          const idParam = pathParts[pathParts.length - 1]

          if (idParam === 'agreement') {
            return Response.json(
              { error: 'Agreement ID is required' },
              { status: 400 }
            )
          }

          const body = await request.json()
          const {
            title,
            description,
            distributionType,
            effectiveDate,
            expiryDate,
          } = body

          // Check if agreement exists and belongs to user
          const existingAgreement = await prisma.agreement.findFirst({
            where: {
              id: idParam,
              ownerId: session.user.id,
            },
          })

          if (!existingAgreement) {
            return Response.json(
              { error: 'Agreement not found' },
              { status: 404 }
            )
          }

          // Check if can be edited
          if (!canEditAgreement(existingAgreement.status, session.user.id, existingAgreement.ownerId)) {
            return Response.json(
              { error: 'Agreement can only be edited in DRAFT status' },
              { status: 403 }
            )
          }

          // Validate input
          const validation = validateAgreementInput({
            title,
            description,
            distributionType,
            effectiveDate,
            expiryDate,
          })

          if (!validation.valid) {
            return Response.json(
              { error: 'Validation failed', details: validation.errors },
              { status: 400 }
            )
          }

          // Update agreement
          const agreement = await prisma.agreement.update({
            where: { id: idParam },
            data: {
              title: title ?? existingAgreement.title,
              description: description !== undefined ? description : existingAgreement.description,
              distributionType: distributionType ?? existingAgreement.distributionType,
              effectiveDate: effectiveDate !== undefined ? new Date(effectiveDate) : existingAgreement.effectiveDate,
              expiryDate: expiryDate !== undefined ? new Date(expiryDate) : existingAgreement.expiryDate,
            },
          })

          // Keep on-chain metadata fresh when a minted DRAFT agreement is edited
          // (contract resets signatures, which is harmless while still in DRAFT)
          let onChainUpdateTxHash: string | null = null
          if (existingAgreement.tokenId != null && isContractConfigured()) {
            try {
              const { metadataUri } = await refreshAgreementMetadataUri(idParam)
              const result = await updateAgreementMetadata(
                existingAgreement.tokenId,
                metadataUri,
              )
              onChainUpdateTxHash = result.txHash
            } catch (metadataError) {
              console.error('Error refreshing on-chain agreement metadata:', metadataError)
            }
          }

          return Response.json({
            success: true,
            agreement: {
              id: agreement.id,
              title: agreement.title,
              description: agreement.description,
              distributionType: agreement.distributionType,
              status: agreement.status,
              effectiveDate: agreement.effectiveDate?.toISOString(),
              expiryDate: agreement.expiryDate?.toISOString(),
            },
            onChain: onChainUpdateTxHash
              ? {
                  metadataUpdateTxHash: onChainUpdateTxHash,
                  metadataUpdateExplorerUrl: getExplorerUrl(onChainUpdateTxHash),
                }
              : null,
          })
        } catch (error) {
          console.error('Error updating agreement:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },

      // DELETE /api/agreement - Delete agreement
      DELETE: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const pathParts = url.pathname.split('/')
          const idParam = pathParts[pathParts.length - 1]

          if (idParam === 'agreement') {
            return Response.json(
              { error: 'Agreement ID is required' },
              { status: 400 }
            )
          }

          // Check if agreement exists and belongs to user
          const agreement = await prisma.agreement.findFirst({
            where: {
              id: idParam,
              ownerId: session.user.id,
            },
          })

          if (!agreement) {
            return Response.json(
              { error: 'Agreement not found' },
              { status: 404 }
            )
          }

          // Can only delete DRAFT agreements
          if (agreement.status !== 'DRAFT') {
            return Response.json(
              { error: 'Only DRAFT agreements can be deleted. Use cancel for other statuses.' },
              { status: 403 }
            )
          }

          // Delete agreement (cascade will handle related records)
          await prisma.agreement.delete({
            where: { id: idParam },
          })

          return Response.json({
            success: true,
            message: 'Agreement deleted successfully',
          })
        } catch (error) {
          console.error('Error deleting agreement:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },
}

export const Route = createFileRoute('/api/agreement/$')({
  server: {
    handlers: agreementHandlers,
  },
})
