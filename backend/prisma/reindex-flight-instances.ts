/**
 * Rebuilds the `flight_instances` Elasticsearch index from PostgreSQL.
 *
 * **Deletes the existing index first** so stale docs (e.g. after `prisma migrate reset` + seed,
 * when instance UUIDs change) cannot appear in search.
 *
 *   cd backend && npm run prisma:reindex-search
 */
import { Client, type estypes } from '@elastic/elasticsearch';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/flightbooking';

const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const es = new Client({ node: esUrl });

const INDEX = 'flight_instances';

const INDEX_MAPPINGS: estypes.MappingTypeMapping = {
  properties: {
    id: { type: 'keyword' },
    instanceId: { type: 'keyword' },
    flightId: { type: 'keyword' },
    airlineId: { type: 'keyword' },
    airlineName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    flightNumber: { type: 'keyword' },
    origin: { type: 'keyword' },
    destination: { type: 'keyword' },
    departureAt: { type: 'date' },
    arrivalAt: { type: 'date' },
    status: { type: 'keyword' },
    availableSeats: { type: 'integer' },
    economyPrice: { type: 'float' },
    businessPrice: { type: 'float' },
  },
};

/** Drop index if present, then create empty index (removes stale IDs after DB reset). */
async function resetIndex() {
  const exists = await es.indices.exists({ index: INDEX });
  if (exists) {
    console.log(`Deleting Elasticsearch index "${INDEX}" (stale documents after DB wipe).`);
    await es.indices.delete({ index: INDEX });
  }

  await es.indices.create({
    index: INDEX,
    mappings: INDEX_MAPPINGS,
  });
  console.log(`Created empty index "${INDEX}".`);
}

function toDoc(inst: {
  id: string;
  instanceId: string;
  flightId: string;
  departureAt: Date;
  arrivalAt: Date;
  status: string;
  flight: {
    airlineId: string;
    flightNumber: string;
    origin: string;
    destination: string;
    airline: { name: string };
  };
}) {
  return {
    id: inst.id,
    instanceId: inst.instanceId,
    flightId: inst.flightId,
    airlineId: inst.flight.airlineId,
    airlineName: inst.flight.airline.name,
    flightNumber: inst.flight.flightNumber,
    origin: inst.flight.origin.toUpperCase(),
    destination: inst.flight.destination.toUpperCase(),
    departureAt: inst.departureAt.toISOString(),
    arrivalAt: inst.arrivalAt.toISOString(),
    status: inst.status,
  };
}

async function main() {
  await resetIndex();

  const instances = await prisma.flightInstance.findMany({
    include: { flight: { include: { airline: true } } },
    orderBy: { departureAt: 'asc' },
  });

  let indexed = 0;
  for (const inst of instances) {
    await es.index({
      index: INDEX,
      id: inst.id,
      document: toDoc(inst),
    });
    indexed += 1;
    if (indexed % 50 === 0 || indexed === instances.length) {
      process.stdout.write(`\rIndexed ${indexed}/${instances.length}`);
    }
  }

  await es.indices.refresh({ index: INDEX });

  console.log(`\nDone. Indexed ${instances.length} document(s) into "${INDEX}" at ${esUrl}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
