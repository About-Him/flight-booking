import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { useAuth } from '../../context/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const response = await client.get('/admin/dashboard');
      return response.data as { flights: number; pendingValidation: number; pendingApproval: number };
    },
  });

  return (
    <main className="panel hero stack">
      <h1 className="page-title">Admin</h1>
      <p className="muted" style={{ margin: 0 }}>
        {user?.email} · {user?.role}
      </p>
      <div className="grid grid-3">
        <div className="card">
          <div className="field-label">Flights</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{data?.flights ?? '—'}</div>
        </div>
        <div className="card">
          <div className="field-label">To validate</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{data?.pendingValidation ?? '—'}</div>
        </div>
        <div className="card">
          <div className="field-label">To approve</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{data?.pendingApproval ?? '—'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Link className="btn btn-primary" to="/admin/bookings" style={{ textDecoration: 'none' }}>
          Bookings
        </Link>
        <Link className="btn btn-ghost" to="/admin/flights" style={{ textDecoration: 'none' }}>
          Schedules
        </Link>
        {user?.role === 'SUPERADMIN' && (
          <Link className="btn btn-ghost" to="/superadmin/airlines" style={{ textDecoration: 'none' }}>
            Airlines
          </Link>
        )}
      </div>
    </main>
  );
}
