export type Role = 'USER' | 'ASSOCIATE' | 'SENIOR_ASSOCIATE' | 'SUPERADMIN';

export interface User {
  id: string;
  email: string;
  role: Role;
  airlineId?: string | null;
}

export interface AirportOption {
  value: string;
  label: string;
}

export interface FlightResult {
  id: string;
  instanceId: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  airlineName: string;
  availableSeats?: number;
}
