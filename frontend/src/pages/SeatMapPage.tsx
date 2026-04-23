import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';

type SeatRow = {
  id: string;
  seatNumber: string;
  class: string;
  basePrice: string;
  status: string;
};

type FlightDetail = {
  id: string;
  instanceId: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureAt: string;
  airlineName: string;
  seats: SeatRow[];
};

const SEAT_CLASS_ORDER = ['FIRST', 'BUSINESS', 'ECONOMY'];

export default function SeatMapPage() {
  const { instanceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const travellers = Math.max(1, Number(searchParams.get('travellers') || '1') || 1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['flight-instance', instanceId],
    queryFn: async () => {
      const res = await client.get<FlightDetail>(`/flights/${instanceId}`);
      return res.data;
    },
    enabled: !!instanceId,
  });

  const [passengerNames, setPassengerNames] = useState<string[]>(() => Array.from({ length: travellers }, () => ''));
  const [namesConfirmed, setNamesConfirmed] = useState(false);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const seatsByClass = useMemo(() => {
    if (!data?.seats) return new Map<string, SeatRow[]>();
    const map = new Map<string, SeatRow[]>();
    for (const seat of data.seats) {
      if (seat.status !== 'AVAILABLE' && seat.status !== 'LOCKED') continue;
      const list = map.get(seat.class) ?? [];
      list.push(seat);
      map.set(seat.class, list);
    }
    return map;
  }, [data]);

  function toggleSeat(seat: SeatRow) {
    if (seat.status !== 'AVAILABLE') return;
    setSelectedSeatIds((prev) => {
      if (prev.includes(seat.id)) return prev.filter((id) => id !== seat.id);
      if (prev.length >= travellers) return prev;
      return [...prev, seat.id];
    });
  }

  async function continueToPayment() {
    if (!instanceId || selectedSeatIds.length !== travellers) return;
    setSubmitting(true);
    try {
      const res = await client.post('/bookings/initiate', {
        instanceId,
        seatIds: selectedSeatIds,
        passengerNames: passengerNames.slice(0, travellers),
      });
      const bookingId = res.data.booking?.id as string;
      navigate(`/checkout/${bookingId}`);
    } finally {
      setSubmitting(false);
    }
  }

  const namesOk = passengerNames.slice(0, travellers).every((n) => n.trim().length > 0);
  const total = selectedSeatIds.reduce((sum, id) => {
    const seat = data?.seats.find((s) => s.id === id);
    return sum + (seat ? Number(seat.basePrice) : 0);
  }, 0);

  if (isLoading) {
    return (
      <main className="panel hero">
        <p className="muted" style={{ margin: 0 }}>Loading…</p>
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="panel hero">
        <p className="muted" style={{ margin: 0 }}>Could not load this flight.</p>
      </main>
    );
  }

  return (
    <main className="panel hero stack">
      <div>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          {data.flightNumber} {data.origin}–{data.destination}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {data.airlineName} · {new Date(data.departureAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </div>

      <section className="stack card">
        <h2 className="page-title" style={{ fontSize: '1rem', margin: 0 }}>
          Passengers
        </h2>
        {Array.from({ length: travellers }).map((_, i) => (
          <label key={i} className="field">
            <span className="field-label">Name {i + 1}</span>
            <input
              className="input"
              value={passengerNames[i] ?? ''}
              disabled={namesConfirmed}
              onChange={(e) =>
                setPassengerNames((prev) => {
                  const next = [...prev];
                  next[i] = e.target.value;
                  return next;
                })
              }
            />
          </label>
        ))}
        {!namesConfirmed ? (
          <button className="btn btn-primary" type="button" disabled={!namesOk} onClick={() => setNamesConfirmed(true)}>
            Next: seats
          </button>
        ) : (
          <button className="btn btn-ghost" type="button" onClick={() => setNamesConfirmed(false)}>
            Edit names
          </button>
        )}
      </section>

      {namesConfirmed && (
        <section className="stack card">
          <h2 className="page-title" style={{ fontSize: '1rem', margin: 0 }}>
            Seats ({selectedSeatIds.length}/{travellers})
          </h2>
          {SEAT_CLASS_ORDER.map((cls) => {
            const list = seatsByClass.get(cls);
            if (!list?.length) return null;
            return (
              <div key={cls} className="stack">
                <span className="field-label">{cls}</span>
                <div className="seat-grid">
                  {list.map((seat) => {
                    const selected = selectedSeatIds.includes(seat.id);
                    const disabled =
                      seat.status !== 'AVAILABLE' || (!selected && selectedSeatIds.length >= travellers);
                    return (
                      <button
                        key={seat.id}
                        type="button"
                        className={`seat ${selected ? 'seat-selected' : ''}`}
                        disabled={disabled}
                        onClick={() => toggleSeat(seat)}
                        title={disabled && !selected ? 'Max seats selected' : undefined}
                      >
                        {seat.seatNumber} ${Number(seat.basePrice).toFixed(0)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="stack" style={{ gap: 8 }}>
            <p style={{ margin: 0 }}>Total ${total.toFixed(2)}</p>
            <button
              className="btn btn-primary"
              type="button"
              disabled={selectedSeatIds.length !== travellers || submitting}
              onClick={() => void continueToPayment()}
            >
              Pay
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
