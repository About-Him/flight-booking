import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <main className="panel hero stack">
      <span className="hero-badge">Search · Seats · Pay</span>
      <h1 className="hero-title">Book your next flight with calm, clear steps.</h1>
      <p className="hero-lead">
        Search routes, choose seats for everyone in your party, pay securely, and follow your booking from checkout to
        the gate.
      </p>
      <div className="btn-row">
        <Link className="btn btn-primary" to="/search" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          Search flights
        </Link>
        {user ? (
          <Link className="btn btn-ghost" to="/bookings" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            My bookings
          </Link>
        ) : (
          <Link className="btn btn-ghost" to="/login" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            Log in
          </Link>
        )}
      </div>
    </main>
  );
}
