import { prisma } from '../../db'
import {
  FamilyRelation,
  INVERSE_RELATIONS,
  getInverseRelation,
} from './familyTypes'
import type { FamilyRelationType } from './familyTypes'

// Re-export types for server-side usage
export { FamilyRelation, type FamilyRelationType, INVERSE_RELATIONS, getInverseRelation }

/**
 * Creates a bidirectional family relationship between two users.
 * When User A adds User B with a relation, this also creates the inverse relation from B to A.
 *
 * @param userId - The user creating the family link
 * @param familyMemberUserId - The user being added as family member
 * @param relation - The relation from userId's perspective (e.g., FATHER means "my father")
 * @returns Both created family member records
 */
export async function createBidirectionalFamilyRelation(
  userId: string,
  familyMemberUserId: string,
  relation: FamilyRelationType
) {
  const inverseRelation = getInverseRelation(relation)

  // Use a transaction to ensure both records are created or neither
  const [familyMember, inverseFamilyMember] = await prisma.$transaction([
    // Create the original relation (A -> B)
    prisma.familyMember.create({
      data: {
        userId,
        familyMemberUserId,
        relation: relation as any, // Type assertion for Prisma enum compatibility
      },
    }),
    // Create the inverse relation (B -> A)
    prisma.familyMember.create({
      data: {
        userId: familyMemberUserId,
        familyMemberUserId: userId,
        relation: inverseRelation as any, // Type assertion for Prisma enum compatibility
      },
    }),
  ])

  return { familyMember, inverseFamilyMember }
}

/**
 * Deletes a bidirectional family relationship between two users.
 * Removes both the original relation and its inverse.
 *
 * @param userId - One user in the relationship
 * @param familyMemberUserId - The other user in the relationship
 */
export async function deleteBidirectionalFamilyRelation(
  userId: string,
  familyMemberUserId: string
) {
  await prisma.$transaction([
    // Delete A -> B
    prisma.familyMember.deleteMany({
      where: {
        userId,
        familyMemberUserId,
      },
    }),
    // Delete B -> A
    prisma.familyMember.deleteMany({
      where: {
        userId: familyMemberUserId,
        familyMemberUserId: userId,
      },
    }),
  ])
}

/**
 * Get all family members for a user (from their familyMembers relation).
 * This returns people the user has explicitly added as family.
 */
export async function getFamilyMembers(userId: string) {
  return prisma.familyMember.findMany({
    where: { userId },
    include: {
      familyMemberUser: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          icNumber: true,
        },
      },
    },
  })
}

/**
 * Converts non-registered family members to registered family members when a user registers.
 * This function should be called after a new user successfully registers and authenticates.
 *
 * It will:
 * 1. Find all NonRegisteredFamilyMember records matching the new user's IC number
 * 2. Create bidirectional FamilyMember relationships for each
 * 3. Delete the NonRegisteredFamilyMember records
 *
 * @param newUserId - The ID of the newly registered user
 * @param icNumber - The IC number of the newly registered user
 * @returns Object containing converted relationships count and any errors
 */
export async function convertNonRegisteredToFamilyMembers(
  newUserId: string,
  icNumber: string
) {
  // Find all non-registered family member records with this IC number
  const nonRegisteredMembers = await prisma.nonRegisteredFamilyMember.findMany({
    where: { icNumber },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (nonRegisteredMembers.length === 0) {
    return {
      converted: 0,
      relationships: [],
      message: 'No non-registered family members found with this IC number',
    }
  }

  const convertedRelationships: Array<{
    fromUserId: string;
    fromUserName: string;
    relation: FamilyRelationType;
  }> = []

  // Use a transaction to ensure all operations succeed or fail together
  await prisma.$transaction(async (tx) => {
    for (const nonRegistered of nonRegisteredMembers) {
      const inverseRelation = getInverseRelation(nonRegistered.relation as FamilyRelationType)

      // Create bidirectional family relationship
      // 1. The user who added the non-registered member gets them as family
      await tx.familyMember.create({
        data: {
          userId: nonRegistered.userId,
          familyMemberUserId: newUserId,
          relation: nonRegistered.relation as any, // Type assertion for Prisma enum compatibility
        },
      })

      // 2. The new user gets the inverse relationship
      await tx.familyMember.create({
        data: {
          userId: newUserId,
          familyMemberUserId: nonRegistered.userId,
          relation: inverseRelation as any, // Type assertion for Prisma enum compatibility
        },
      })

      convertedRelationships.push({
        fromUserId: nonRegistered.userId,
        fromUserName: nonRegistered.user.name,
        relation: nonRegistered.relation as FamilyRelationType,
      })
    }

    // Delete all the non-registered family member records
    await tx.nonRegisteredFamilyMember.deleteMany({
      where: { icNumber },
    })
  })

  return {
    converted: convertedRelationships.length,
    relationships: convertedRelationships,
    message: `Successfully converted ${convertedRelationships.length} non-registered family member(s) to registered relationships`,
  }
}

/**
 * Check if there are any pending non-registered family member records for a given IC number.
 * Useful to show a notification to newly registered users.
 *
 * @param icNumber - The IC number to check
 * @returns Array of users who have added this IC as a non-registered family member
 */
export async function getPendingFamilyConnections(icNumber: string) {
  return prisma.nonRegisteredFamilyMember.findMany({
    where: { icNumber },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  })
}

/**
 * Get all non-registered family members for a user.
 *
 * @param userId - The user to get non-registered family members for
 * @returns Array of non-registered family members
 */
export async function getNonRegisteredFamilyMembers(userId: string) {
  return prisma.nonRegisteredFamilyMember.findMany({
    where: { userId },
  })
}

/**
 * Update a bidirectional family relationship.
 * Updates both the original relation and its inverse.
 *
 * @param userId - One user in the relationship
 * @param familyMemberUserId - The other user in the relationship
 * @param newRelation - The new relation from userId's perspective
 */
export async function updateBidirectionalFamilyRelation(
  userId: string,
  familyMemberUserId: string,
  newRelation: FamilyRelationType
) {
  const inverseRelation = getInverseRelation(newRelation)

  await prisma.$transaction([
    // Update A -> B
    prisma.familyMember.updateMany({
      where: {
        userId,
        familyMemberUserId,
      },
      data: {
        relation: newRelation as any, // Type assertion for Prisma enum compatibility
      },
    }),
    // Update B -> A
    prisma.familyMember.updateMany({
      where: {
        userId: familyMemberUserId,
        familyMemberUserId: userId,
      },
      data: {
        relation: inverseRelation as any, // Type assertion for Prisma enum compatibility
      },
    }),
  ])
}

/**
 * Update a non-registered family member.
 * Handles IC registry updates when IC number changes.
 *
 * @param id - The ID of the non-registered family member
 * @param data - The fields to update
 */
export async function updateNonRegisteredFamilyMember(
  id: number,
  data: {
    relation?: FamilyRelationType
    name?: string
    icNumber?: string
    address?: string | null
    phoneNumber?: string | null
  }
) {
  // If IC number is being updated, we need to handle the registry
  if (data.icNumber) {
    // Get the current IC number
    const current = await prisma.nonRegisteredFamilyMember.findUnique({
      where: { id },
      select: { icNumber: true },
    })

    if (current && current.icNumber !== data.icNumber) {
      // Check if new IC already exists in registry
      const existingIc = await prisma.icRegistry.findUnique({
        where: { icNumber: data.icNumber },
      })

      if (existingIc) {
        throw new Error('IC number already exists in the system')
      }

      // Use transaction to update IC registry and member
      return prisma.$transaction(async (tx) => {
        // Delete old IC from registry
        await tx.icRegistry.delete({
          where: { icNumber: current.icNumber },
        }).catch(() => {
          // Ignore if it doesn't exist (for legacy data)
        })

        // Create new IC registry entry
        await tx.icRegistry.create({
          data: { icNumber: data.icNumber! },
        })

        // Update the member
        return tx.nonRegisteredFamilyMember.update({
          where: { id },
          data: {
            ...data,
            relation: data.relation as any,
          },
        })
      })
    }
  }

  // No IC change, just update normally
  return prisma.nonRegisteredFamilyMember.update({
    where: { id },
    data: {
      ...data,
      relation: data.relation as any, // Type assertion for Prisma enum compatibility
    },
  })
}

/**
 * Delete a non-registered family member.
 * Also removes the IC from the registry.
 *
 * @param id - The ID of the non-registered family member to delete
 */
export async function deleteNonRegisteredFamilyMember(id: number) {
  // Get the IC number first
  const member = await prisma.nonRegisteredFamilyMember.findUnique({
    where: { id },
    select: { icNumber: true },
  })

  if (!member) {
    throw new Error('Non-registered family member not found')
  }

  // Delete both the member and the IC registry entry in a transaction
  return prisma.$transaction(async (tx) => {
    // Delete the member first (due to foreign key constraint)
    await tx.nonRegisteredFamilyMember.delete({
      where: { id },
    })

    // Then delete the IC from registry
    await tx.icRegistry.delete({
      where: { icNumber: member.icNumber },
    }).catch(() => {
      // Ignore if it doesn't exist (for legacy data)
    })
  })
}
