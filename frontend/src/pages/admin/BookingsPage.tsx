import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import type { Role } from '../../types';

export default function BookingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: async () => {
      const res = await client.get('/admin/bookings');
      return res.data as Array<{
        id: string;
        status: string;
        user: { name: string; email: string };
        instance: { flight: { flightNumber: string; origin: string; destination: string } };
      }>;
    },
  });

  const passM = useMutation({
    mutationFn: (id: string) => client.post(`/admin/bookings/${id}/pass`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-bookings'] }),
  });
  const approveM = useMutation({
    mutationFn: (id: string) => client.post(`/admin/bookings/${id}/approve`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-bookings'] }),
  });
  const rejectM = useMutation({
    mutationFn: (id: string) => client.post(`/admin/bookings/${id}/reject`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-bookings'] }),
  });

  const role = (JSON.parse(localStorage.getItem('user') || '{}') as { role?: Role }).role;

  return (
    <main className="panel hero stack">
      <h1 className="page-title">Bookings</h1>
      <Link className="nav-link" to="/admin">
        ← Admin
      </Link>
      {isLoading && <p className="muted" style={{ margin: 0 }}>Loading…</p>}
      <div className="stack">
        {(data ?? []).map((b) => (
          <div key={b.id} className="card stack">
            <div>
              {b.instance.flight.flightNumber} {b.instance.flight.origin}–{b.instance.flight.destination}
            </div>
            <div className="muted">
              {b.user.name} · {b.user.email}
            </div>
            <div style={{ fontSize: '0.9rem' }}>{b.status.replace(/_/g, ' ')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(role === 'ASSOCIATE' || role === 'SUPERADMIN') && b.status === 'PENDING_VALIDATION' && (
                <button type="button" className="btn btn-primary" disabled={passM.isPending} onClick={() => passM.mutate(b.id)}>
                  Pass
                </button>
              )}
              {(role === 'SENIOR_ASSOCIATE' || role === 'SUPERADMIN') && b.status === 'PENDING_APPROVAL' && (
                <>
                  <button type="button" className="btn btn-primary" disabled={approveM.isPending} onClick={() => approveM.mutate(b.id)}>
                    Approve
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={rejectM.isPending} onClick={() => rejectM.mutate(b.id)}>
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
