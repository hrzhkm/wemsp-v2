import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
// If your Prisma file is located elsewhere, you can change the path
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'
import { sendEmail } from "./email";

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  })

const prisma = new PrismaClient({ adapter });
export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql", // or "mysql", "postgresql", ...etc
    }),
    user: {
      additionalFields: {
        icNumber: {
          type: "string",
          required: false,
        },
        phoneNumber: {
          type: "string",
          required: false,
        },
        address: {
          type: "string",
          required: false,
        },
        role: {
          type: "string",
          required: false,
          defaultValue: "USER",
          input: false,
        },
      },
    },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      enabled: true,
    }
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Verify your email address",
        `Click the link below to verify your email:\n\n${url}\n\nThis link will expire in 24 hours.`
      );
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  verification: {
    modelName: "verification",
  }
});