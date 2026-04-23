import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/flightbooking';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type Row = {
  iataCode: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
};

async function main() {
  const file = join(__dirname, 'data', 'airports-extra.json');
  const rows = JSON.parse(readFileSync(file, 'utf8')) as Row[];
  for (const row of rows) {
    await prisma.airport.upsert({
      where: { iataCode: row.iataCode },
      update: row,
      create: row,
    });
  }
  console.log(`Airport bulk seed complete: ${rows.length} airports`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
