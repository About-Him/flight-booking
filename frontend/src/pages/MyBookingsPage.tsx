import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import client from '../api/client';

type BookingRow = {
  id: string;
  status: string;
  instance: {
    departureAt: string;
    flight: { flightNumber: string; origin: string; destination: string; airline: { name: string } };
  };
};

export default function MyBookingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['bookings-mine'],
    queryFn: async () => {
      const response = await client.get<BookingRow[]>('/bookings/mine');
      return response.data;
    },
  });

  const checkinM = useMutation({
    mutationFn: async (bookingId: string) => {
      const elig = await client.get(`/checkin/${bookingId}`);
      if (!(elig.data as { canCheckIn: boolean }).canCheckIn) {
        throw new Error('Check-in opens 2–47 hours before departure.');
      }
      await client.post(`/checkin/${bookingId}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bookings-mine'] }),
    onError: (e) => {
      window.alert(e instanceof Error ? e.message : 'Check-in failed');
    },
  });

  const rows = data ?? [];

  return (
    <main className="panel hero stack">
      <h1 className="page-title">My bookings</h1>
      {isLoading && <p className="muted" style={{ margin: 0 }}>Loading…</p>}
      {!isLoading && rows.length === 0 && <p className="muted" style={{ margin: 0 }}>No bookings yet.</p>}
      <div className="stack">
        {rows.map((b) => (
          <div key={b.id} className="card stack">
            <div>
              {b.instance.flight.flightNumber} {b.instance.flight.origin}–{b.instance.flight.destination}
            </div>
            <div className="muted">
              {b.instance.flight.airline.name} · {new Date(b.instance.departureAt).toLocaleDateString()}
            </div>
            <div style={{ fontSize: '0.9rem' }}>{b.status.replace(/_/g, ' ')}</div>
            {b.status === 'CONFIRMED' && (
              <button type="button" className="btn btn-ghost" disabled={checkinM.isPending} onClick={() => checkinM.mutate(b.id)}>
                Check in
              </button>
            )}
            {b.status === 'CHECKED_IN' && <p className="muted" style={{ margin: 0 }}>Checked in</p>}
          </div>
        ))}
      </div>
      <Link className="nav-link" to="/search">
        Search flights
      </Link>
    </main>
  );
}
