-- Delete all existing Environment rows (apiKey plaintext is unrecoverable; owners will create new environments)
DELETE FROM "Environment";

-- Drop the old plaintext apiKey column
ALTER TABLE "Environment" DROP COLUMN "apiKey";

-- Add hashed key columns
ALTER TABLE "Environment" ADD COLUMN "apiKeyId"   TEXT NOT NULL;
ALTER TABLE "Environment" ADD COLUMN "apiKeyHash" TEXT NOT NULL;

-- Unique index on the lookup handle
CREATE UNIQUE INDEX "Environment_apiKeyId_key" ON "Environment"("apiKeyId");

-- Unique constraint: environment names must be unique within a project
CREATE UNIQUE INDEX "Environment_projectId_name_key" ON "Environment"("projectId", "name");
