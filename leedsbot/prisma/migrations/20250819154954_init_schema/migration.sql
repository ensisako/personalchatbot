-- CreateEnum
CREATE TYPE "public"."Degree" AS ENUM ('BACHELORS', 'MASTERS', 'PHD');

-- CreateEnum
CREATE TYPE "public"."SubjectName" AS ENUM ('MATHS', 'MIDGE', 'DATABASE_SYSTEMS');

-- CreateEnum
CREATE TYPE "public"."Level" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateTable
CREATE TABLE "public"."User" (
    "email" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "degree" "public"."Degree" NOT NULL,
    "goals" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "public"."UserSubjectLevel" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "subject" "public"."SubjectName" NOT NULL,
    "level" "public"."Level" NOT NULL,

    CONSTRAINT "UserSubjectLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConsentSetting" (
    "userEmail" TEXT NOT NULL,
    "shareSameLevelUploads" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ConsentSetting_pkey" PRIMARY KEY ("userEmail")
);

-- CreateTable
CREATE TABLE "public"."Document" (
    "id" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "subject" "public"."SubjectName" NOT NULL,
    "level" "public"."Level" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "textContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuizAttempt" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "subject" "public"."SubjectName" NOT NULL,
    "items" JSONB NOT NULL,
    "responses" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "public"."User"("studentId");

-- CreateIndex
CREATE INDEX "UserSubjectLevel_userEmail_subject_idx" ON "public"."UserSubjectLevel"("userEmail", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubjectLevel_userEmail_subject_key" ON "public"."UserSubjectLevel"("userEmail", "subject");

-- CreateIndex
CREATE INDEX "Document_ownerEmail_idx" ON "public"."Document"("ownerEmail");

-- CreateIndex
CREATE INDEX "Document_subject_level_idx" ON "public"."Document"("subject", "level");

-- CreateIndex
CREATE INDEX "QuizAttempt_userEmail_subject_createdAt_idx" ON "public"."QuizAttempt"("userEmail", "subject", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."UserSubjectLevel" ADD CONSTRAINT "UserSubjectLevel_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "public"."User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsentSetting" ADD CONSTRAINT "ConsentSetting_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "public"."User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Document" ADD CONSTRAINT "Document_ownerEmail_fkey" FOREIGN KEY ("ownerEmail") REFERENCES "public"."User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuizAttempt" ADD CONSTRAINT "QuizAttempt_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "public"."User"("email") ON DELETE CASCADE ON UPDATE CASCADE;
