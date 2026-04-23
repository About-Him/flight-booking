import { Link, useParams } from 'react-router-dom';

export default function BookingConfirmPage() {
  const { bookingId } = useParams();

  return (
    <main className="panel hero stack">
      <h1 className="page-title">Paid</h1>
      <p className="muted" style={{ margin: 0 }}>
        Booking <strong>{bookingId}</strong> is waiting for the airline to confirm. You’ll get email updates.
      </p>
      <Link className="btn btn-primary" to="/bookings" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>
        My bookings
      </Link>
    </main>
  );
}
