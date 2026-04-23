import { PrismaPg } from '@prisma/adapter-pg';
import { FlightStatus, PrismaClient, Role, SeatStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { defaultSeatSpecs } from '../src/flights/default-seat-layout';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/flightbooking';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type FlightSeed = {
  airlineCode: string;
  airlineName: string;
  flightId: string;
  flightNumber: string;
  origin: string;
  destination: string;
  durationMins: number;
  departureOffsetDays: number;
  departureHour: number;
  departureMinute: number;
};

type UserSeed = {
  email: string;
  name: string;
  password: string;
  role: Role;
  airlineCode?: string;
};

type AirportSeed = {
  iataCode: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
};

const flightSeeds: FlightSeed[] = [
  {
    airlineCode: 'FB',
    airlineName: 'Flight Booking Air',
    flightId: 'seed-flight-fb101',
    flightNumber: 'FB101',
    origin: 'JFK',
    destination: 'LAX',
    durationMins: 360,
    departureOffsetDays: 1,
    departureHour: 9,
    departureMinute: 30,
  },
  {
    airlineCode: 'FB',
    airlineName: 'Flight Booking Air',
    flightId: 'seed-flight-fb202',
    flightNumber: 'FB202',
    origin: 'SFO',
    destination: 'JFK',
    durationMins: 330,
    departureOffsetDays: 2,
    departureHour: 14,
    departureMinute: 15,
  },
  {
    airlineCode: 'SK',
    airlineName: 'SkyLink',
    flightId: 'seed-flight-sk303',
    flightNumber: 'SK303',
    origin: 'DEL',
    destination: 'BOM',
    durationMins: 150,
    departureOffsetDays: 1,
    departureHour: 8,
    departureMinute: 45,
  },
  {
    airlineCode: 'SK',
    airlineName: 'SkyLink',
    flightId: 'seed-flight-sk404',
    flightNumber: 'SK404',
    origin: 'BOM',
    destination: 'BLR',
    durationMins: 125,
    departureOffsetDays: 3,
    departureHour: 19,
    departureMinute: 0,
  },
  {
    airlineCode: 'NM',
    airlineName: 'Nimbus Air',
    flightId: 'seed-flight-nm505',
    flightNumber: 'NM505',
    origin: 'LHR',
    destination: 'DXB',
    durationMins: 420,
    departureOffsetDays: 2,
    departureHour: 11,
    departureMinute: 20,
  },
  {
    airlineCode: 'NM',
    airlineName: 'Nimbus Air',
    flightId: 'seed-flight-nm606',
    flightNumber: 'NM606',
    origin: 'DXB',
    destination: 'SIN',
    durationMins: 430,
    departureOffsetDays: 4,
    departureHour: 22,
    departureMinute: 10,
  },
];

const userSeeds: UserSeed[] = [
  {
    email: 'user@flightbooking.com',
    name: 'Demo User',
    password: 'User@123456',
    role: Role.USER,
  },
  {
    email: 'associate@flightbooking.com',
    name: 'Demo Associate',
    password: 'Associate@123456',
    role: Role.ASSOCIATE,
    airlineCode: 'FB',
  },
  {
    email: 'senior@flightbooking.com',
    name: 'Demo Senior Associate',
    password: 'Senior@123456',
    role: Role.SENIOR_ASSOCIATE,
    airlineCode: 'FB',
  },
  {
    email: 'superadmin@flightbooking.com',
    name: 'Superadmin',
    password: 'Admin@123456',
    role: Role.SUPERADMIN,
  },
];

const airportSeeds: AirportSeed[] = [
  { iataCode: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', countryCode: 'US' },
  { iataCode: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', countryCode: 'US' },
  { iataCode: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States', countryCode: 'US' },
  { iataCode: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'India', countryCode: 'IN' },
  { iataCode: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India', countryCode: 'IN' },
  { iataCode: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'India', countryCode: 'IN' },
  { iataCode: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'United Kingdom', countryCode: 'GB' },
  { iataCode: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE' },
  { iataCode: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', countryCode: 'SG' },
];

function buildDate(offsetDays: number, hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function main() {
  for (const airport of airportSeeds) {
    await prisma.airport.upsert({
      where: { iataCode: airport.iataCode },
      update: airport,
      create: airport,
    });
  }

  const airlines = await Promise.all(
    [
      { code: 'FB', name: 'Flight Booking Air' },
      { code: 'SK', name: 'SkyLink' },
      { code: 'NM', name: 'Nimbus Air' },
    ].map((airline) =>
      prisma.airline.upsert({
        where: { code: airline.code },
        update: { name: airline.name },
        create: airline,
      }),
    ),
  );

  const airlineByCode = new Map(airlines.map((airline) => [airline.code, airline]));

  const users = new Map<string, Awaited<ReturnType<typeof prisma.user.upsert>>>();
  for (const seed of userSeeds) {
    const passwordHash = await bcrypt.hash(seed.password, 10);
    const airlineId = seed.airlineCode ? airlineByCode.get(seed.airlineCode)?.id ?? null : null;

    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {
        name: seed.name,
        passwordHash,
        role: seed.role,
        airlineId,
      },
      create: {
        email: seed.email,
        name: seed.name,
        passwordHash,
        role: seed.role,
        airlineId,
      },
    });
    users.set(seed.email, user);
  }

  const superadmin = users.get('superadmin@flightbooking.com');
  if (!superadmin) {
    throw new Error('Superadmin seed failed');
  }

  let instanceCount = 0;
  for (const seed of flightSeeds) {
    const airline = airlineByCode.get(seed.airlineCode);
    if (!airline) {
      throw new Error(`Missing airline for code ${seed.airlineCode}`);
    }

    const flight = await prisma.flight.upsert({
      where: { id: seed.flightId },
      update: {
        airlineId: airline.id,
        flightNumber: seed.flightNumber,
        origin: seed.origin,
        destination: seed.destination,
        durationMins: seed.durationMins,
      },
      create: {
        id: seed.flightId,
        airlineId: airline.id,
        flightNumber: seed.flightNumber,
        origin: seed.origin,
        destination: seed.destination,
        durationMins: seed.durationMins,
      },
    });

    const scheduleId = `${seed.flightId}-schedule`;
    const departureAt = buildDate(seed.departureOffsetDays, seed.departureHour, seed.departureMinute);
    const arrivalAt = new Date(departureAt);
    arrivalAt.setMinutes(arrivalAt.getMinutes() + seed.durationMins);

    const schedule = await prisma.flightSchedule.upsert({
      where: { id: scheduleId },
      update: {
        flightId: flight.id,
        departureTime: `${String(seed.departureHour).padStart(2, '0')}:${String(seed.departureMinute).padStart(2, '0')}`,
        scheduledDate: departureAt,
        isDaily: false,
        createdById: superadmin.id,
      },
      create: {
        id: scheduleId,
        flightId: flight.id,
        departureTime: `${String(seed.departureHour).padStart(2, '0')}:${String(seed.departureMinute).padStart(2, '0')}`,
        scheduledDate: departureAt,
        isDaily: false,
        createdById: superadmin.id,
      },
    });

    const instance = await prisma.flightInstance.upsert({
      where: { instanceId: `${seed.flightNumber}-${departureAt.toISOString().slice(0, 10).replace(/-/g, '')}` },
      update: {
        flightId: flight.id,
        scheduleId: schedule.id,
        departureAt,
        arrivalAt,
        status: FlightStatus.SCHEDULED,
      },
      create: {
        instanceId: `${seed.flightNumber}-${departureAt.toISOString().slice(0, 10).replace(/-/g, '')}`,
        flightId: flight.id,
        scheduleId: schedule.id,
        departureAt,
        arrivalAt,
        status: FlightStatus.SCHEDULED,
        seats: {
          createMany: {
            data: defaultSeatSpecs().map((seat) => ({
              seatNumber: seat.seatNumber,
              class: seat.class,
              basePrice: seat.basePrice,
              status: SeatStatus.AVAILABLE,
            })),
          },
        },
      },
    });

    instanceCount += 1;
    console.log(`Seeded ${seed.flightNumber} (${seed.origin} -> ${seed.destination})`);
    void instance;
  }

  console.log('Seed complete:', {
    users: userSeeds.map((user) => user.email),
    airports: airportSeeds.length,
    airlines: airlines.length,
    flights: flightSeeds.length,
    instances: instanceCount,
  });
  console.log(
    'Using Elasticsearch for search? Rebuild the index so IDs match this DB: npm run prisma:reindex-search',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
