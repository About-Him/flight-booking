import { Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/auth-context';
import { RequireAuth, RequireStaff, RequireSuperadmin } from './components/RequireAuth';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyBookingsPage from './pages/MyBookingsPage';
import SeatMapPage from './pages/SeatMapPage';
import CheckoutPage from './pages/CheckoutPage';
import BookingConfirmPage from './pages/BookingConfirmPage';
import DashboardPage from './pages/admin/DashboardPage';
import BookingsPage from './pages/admin/BookingsPage';
import FlightsPage from './pages/admin/FlightsPage';
import FlightDetailPage from './pages/admin/FlightDetailPage';
import AirlinesPage from './pages/superadmin/AirlinesPage';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="nav">
      <Link to="/" className="nav-brand">
        <span className="nav-brand-mark" aria-hidden>
          ✈
        </span>
        Flights
      </Link>
      <nav className="nav-links">
        <Link className="nav-link" to="/search">
          Search
        </Link>
        {user && (
          <Link className="nav-link" to="/bookings">
            Bookings
          </Link>
        )}
        {user && user.role !== 'USER' && (
          <Link className="nav-link" to="/admin">
            Admin
          </Link>
        )}
        {user?.role === 'SUPERADMIN' && (
          <Link className="nav-link" to="/superadmin/airlines">
            Airlines
          </Link>
        )}
        {user ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            Log out
          </button>
        ) : (
          <>
            <Link className="nav-link" to="/login">
              Log in
            </Link>
            <Link className="btn btn-primary" to="/register" style={{ textDecoration: 'none', display: 'inline-flex' }}>
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <div className="shell">
      <div className="container">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/bookings"
            element={
              <RequireAuth>
                <MyBookingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/book/:instanceId"
            element={
              <RequireAuth>
                <SeatMapPage />
              </RequireAuth>
            }
          />
          <Route
            path="/checkout/:bookingId"
            element={
              <RequireAuth>
                <CheckoutPage />
              </RequireAuth>
            }
          />
          <Route path="/booking-confirm/:bookingId" element={<BookingConfirmPage />} />
          <Route
            path="/admin"
            element={
              <RequireStaff>
                <DashboardPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin/bookings"
            element={
              <RequireStaff>
                <BookingsPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin/flights"
            element={
              <RequireStaff>
                <FlightsPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin/flights/:flightId"
            element={
              <RequireStaff>
                <FlightDetailPage />
              </RequireStaff>
            }
          />
          <Route
            path="/superadmin/airlines"
            element={
              <RequireSuperadmin>
                <AirlinesPage />
              </RequireSuperadmin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
