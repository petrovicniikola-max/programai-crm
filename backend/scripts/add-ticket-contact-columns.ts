/**
 * Jednokratno dodavanje kolona contactMethod i contactsContactedCount u Ticket.
 * Pokretanje: npm run prisma:add-call-fields (iz backend foldera)
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL nije postavljen. Proverite .env u backend folderu.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "contactMethod" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "contactsContactedCount" INTEGER;
  `);
  console.log('Kolone contactMethod i contactsContactedCount dodate (ili već postoje).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
