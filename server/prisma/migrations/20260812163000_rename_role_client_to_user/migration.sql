-- Rename the Role enum value CLIENT -> USER to match the approved requirement.
--
-- Written by hand: `prisma migrate dev` wanted to drop and recreate the enum,
-- which fails on rows already holding the old value. ALTER TYPE ... RENAME VALUE
-- keeps the same label OID, so existing rows and the column default stay valid.
ALTER TYPE "Role" RENAME VALUE 'CLIENT' TO 'USER';

-- Re-assert the default explicitly. The rename preserves it, but stating it here
-- keeps the migration self-describing.
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
