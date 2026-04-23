import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AsyncSelect from 'react-select/async';
import client from '../api/client';
import { airportSelectStyles, loadAirportOptions } from '../lib/airport-options';
import type { AirportOption, FlightResult } from '../types';

type TripType = 'one-way' | 'round-trip';

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setParams] = useSearchParams();

  const initialType = (searchParams.get('type') as TripType) || 'one-way';
  const [tripType, setTripType] = useState<TripType>(initialType === 'round-trip' ? 'round-trip' : 'one-way');
  const [origin, setOrigin] = useState<AirportOption | null>(() => {
    const o = searchParams.get('origin');
    return o ? { value: o, label: o } : null;
  });
  const [destination, setDestination] = useState<AirportOption | null>(() => {
    const o = searchParams.get('destination');
    return o ? { value: o, label: o } : null;
  });
  const [date, setDate] = useState(searchParams.get('date') || '');
  const [returnDate, setReturnDate] = useState(searchParams.get('returnDate') || '');
  const [travellers, setTravellers] = useState(Number(searchParams.get('travellers') || '1') || 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FlightResult[] | { outbound: FlightResult[]; return: FlightResult[] } | null>(
    null,
  );

  const loadAirports = useCallback((input: string) => loadAirportOptions(input), []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (origin?.value) next.set('origin', origin.value);
    if (destination?.value) next.set('destination', destination.value);
    if (date) next.set('date', date);
    if (tripType === 'round-trip' && returnDate) next.set('returnDate', returnDate);
    next.set('type', tripType);
    next.set('travellers', String(Math.max(1, travellers)));
    setParams(next, { replace: true });
  }, [origin, destination, date, returnDate, tripType, travellers, setParams]);

  const canSearch = useMemo(() => {
    if (!origin?.value || !destination?.value || !date) return false;
    if (tripType === 'round-trip' && !returnDate) return false;
    return true;
  }, [origin, destination, date, returnDate, tripType]);

  async function runSearch() {
    if (!canSearch) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/flights/search', {
        params:
          tripType === 'one-way'
            ? { type: 'one-way', origin: origin!.value, destination: destination!.value, date }
            : {
                type: 'round-trip',
                origin: origin!.value,
                destination: destination!.value,
                date,
                returnDate,
              },
      });
      setResults(data);
    } catch {
      setError('Search failed.');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  function goBook(instance: FlightResult) {
    const q = new URLSearchParams();
    q.set('travellers', String(Math.max(1, travellers)));
    navigate(`/book/${instance.id}?${q.toString()}`);
  }

  const outboundList: FlightResult[] =
    results && Array.isArray(results) ? results : results && 'outbound' in results ? results.outbound : [];
  const returnList: FlightResult[] =
    results && !Array.isArray(results) && 'return' in results ? results.return : [];

  return (
    <main className="panel hero stack">
      <div>
        <h1 className="page-title" style={{ marginBottom: 6 }}>
          Search flights
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          Pick airports, dates, and trip type — we’ll show what’s scheduled.
        </p>
      </div>

      <div className="stack">
        <div className="grid grid-2">
          <label className="field">
            <span className="field-label">Trip</span>
            <select className="input" value={tripType} onChange={(e) => setTripType(e.target.value as TripType)}>
              <option value="one-way">One way</option>
              <option value="round-trip">Round trip</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Passengers</span>
            <input
              className="input"
              type="number"
              min={1}
              value={travellers}
              onChange={(e) => setTravellers(Number(e.target.value) || 1)}
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">From</span>
          <div className="rs-wrap">
            <AsyncSelect
              cacheOptions
              defaultOptions
              loadOptions={loadAirports}
              value={origin}
              onChange={(v) => setOrigin(v)}
              placeholder="Airport"
              isClearable
              styles={airportSelectStyles}
            />
          </div>
        </label>

        <label className="field">
          <span className="field-label">To</span>
          <div className="rs-wrap">
            <AsyncSelect
              cacheOptions
              defaultOptions
              loadOptions={loadAirports}
              value={destination}
              onChange={(v) => setDestination(v)}
              placeholder="Airport"
              isClearable
              styles={airportSelectStyles}
            />
          </div>
        </label>

        <div className="grid grid-2">
          <label className="field">
            <span className="field-label">Depart</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {tripType === 'round-trip' && (
            <label className="field">
              <span className="field-label">Return</span>
              <input className="input" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </label>
          )}
        </div>

        <button className="btn btn-primary" type="button" disabled={!canSearch || loading} onClick={() => void runSearch()}>
          {loading ? '…' : 'Search'}
        </button>
        {error && <p className="muted" style={{ margin: 0 }}>{error}</p>}
      </div>

      {results && (
        <div className="stack">
          <h2 className="page-title" style={{ fontSize: '1rem', marginBottom: 0 }}>
            {tripType === 'round-trip' ? 'Outbound' : 'Results'}
          </h2>
          {outboundList.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No flights</p>
          ) : (
          <div className="list">
            {outboundList.map((f) => (
              <button key={f.id} type="button" className="list-item" onClick={() => goBook(f)}>
                <div>
                  {f.flightNumber} {f.origin}–{f.destination}
                </div>
                <div className="muted">
                  {f.airlineName} · {new Date(f.departureAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </button>
            ))}
          </div>
          )}

          {tripType === 'round-trip' && (
            <>
              <h2 className="page-title" style={{ fontSize: '1rem', marginBottom: 0 }}>
                Return
              </h2>
              {returnList.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>No flights</p>
              ) : (
              <div className="list">
                {returnList.map((f) => (
                  <button key={f.id} type="button" className="list-item" onClick={() => goBook(f)}>
                    <div>
                      {f.flightNumber} {f.origin}–{f.destination}
                    </div>
                    <div className="muted">
                      {f.airlineName} · {new Date(f.departureAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </button>
                ))}
              </div>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}
