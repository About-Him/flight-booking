import client from '../api/client';
import type { AirportOption } from '../types';

export function formatAirportLabel(a: { iataCode: string; name: string; city: string; countryCode: string }) {
  return `${a.iataCode} — ${a.name}, ${a.city}`;
}

/** One shared in-flight list request (Redis-backed `/airports/list` on the server). */
let airportsListOptionsPromise: Promise<AirportOption[]> | null = null;

export function getAirportsListOptions(): Promise<AirportOption[]> {
  if (!airportsListOptionsPromise) {
    airportsListOptionsPromise = client
      .get('/airports/list')
      .then(({ data }) =>
        (data as { iataCode: string; name: string; city: string; countryCode: string }[]).map((a) => ({
          value: a.iataCode,
          label: formatAirportLabel(a),
        })),
      )
      .catch(() => {
        airportsListOptionsPromise = null;
        return [];
      });
  }
  return airportsListOptionsPromise;
}

/** Same source as Search: `/airports/list` (empty query) and `/airports/search` — both use Redis cache on the API. */
export async function loadAirportOptions(input: string): Promise<AirportOption[]> {
  const q = input.trim();
  if (!q) {
    return getAirportsListOptions();
  }
  const { data } = await client.get('/airports/search', { params: { q } });
  return (data as { iataCode: string; name: string; city: string; countryCode: string }[]).map((a) => ({
    value: a.iataCode,
    label: formatAirportLabel(a),
  }));
}

export const airportSelectStyles = {
  container: (base: object) => ({ ...base, width: '100%' }),
};
