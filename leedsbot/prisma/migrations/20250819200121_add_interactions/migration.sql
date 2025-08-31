-- CreateTable
CREATE TABLE "public"."Interaction" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "subject" "public"."SubjectName" NOT NULL,
    "level" "public"."Level" NOT NULL,
    "prompt" TEXT NOT NULL,
    "answer" TEXT,
    "usedDocIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Interaction_userEmail_subject_level_createdAt_idx" ON "public"."Interaction"("userEmail", "subject", "level", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Interaction" ADD CONSTRAINT "Interaction_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "public"."User"("email") ON DELETE CASCADE ON UPDATE CASCADE;
