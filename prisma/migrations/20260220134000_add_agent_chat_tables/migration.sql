-- CreateEnum
CREATE TYPE "public"."AgentMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "public"."agent_conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "public"."AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_conversation_userId_idx" ON "public"."agent_conversation"("userId");

-- CreateIndex
CREATE INDEX "agent_message_conversationId_createdAt_idx" ON "public"."agent_message"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."agent_conversation" ADD CONSTRAINT "agent_conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_message" ADD CONSTRAINT "agent_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."agent_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
