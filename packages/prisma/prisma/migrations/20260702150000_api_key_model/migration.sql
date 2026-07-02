-- Create the ApiKey table: keys become independent, named, multi-per-environment
-- records instead of one key baked directly into Environment.
CREATE TABLE "ApiKey" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "apiKeyId"      TEXT NOT NULL,
    "apiKeyHash"    TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "revokedAt"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiKey_apiKeyId_key" ON "ApiKey"("apiKeyId");

ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_environmentId_fkey"
    FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every environment's existing key as its first "Default" ApiKey row.
INSERT INTO "ApiKey" ("id", "name", "apiKeyId", "apiKeyHash", "environmentId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Default', "apiKeyId", "apiKeyHash", "id", "createdAt", "updatedAt"
FROM "Environment";

-- Drop the old single-key columns now that they live in ApiKey.
DROP INDEX "Environment_apiKeyId_key";
ALTER TABLE "Environment" DROP COLUMN "apiKeyId";
ALTER TABLE "Environment" DROP COLUMN "apiKeyHash";
