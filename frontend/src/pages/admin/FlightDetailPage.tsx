import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import client from '../../api/client';
import { useAuth } from '../../context/auth-context';

type FlightDetailResponse = {
  flight: {
    id: string;
    flightNumber: string;
    origin: string;
    destination: string;
    durationMins: number;
    airlineId: string;
    airline: { id: string; name: string; code: string };
    _count: { instances: number; schedules: number };
  };
  staff: Array<{ id: string; email: string; name: string; role: string; createdAt: string }>;
};

type StaffRoleOption = 'ASSOCIATE' | 'SENIOR_ASSOCIATE';

export default function FlightDetailPage() {
  const { flightId } = useParams<{ flightId: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRoleOption>('ASSOCIATE');
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-flight-detail', flightId],
    queryFn: async () => {
      const res = await client.get<FlightDetailResponse>(`/admin/flights/${flightId}`);
      return res.data;
    },
    enabled: !!flightId,
  });

  const canAddStaff =
    user?.role === 'SUPERADMIN' || user?.role === 'SENIOR_ASSOCIATE' || user?.role === 'ASSOCIATE';

  const addStaffM = useMutation({
    mutationFn: async () => {
      const r: StaffRoleOption = user?.role === 'SUPERADMIN' ? role : 'ASSOCIATE';
      await client.post(`/admin/flights/${flightId}/staff`, {
        email: email.trim(),
        name: name.trim(),
        password,
        role: r,
      });
    },
    onSuccess: () => {
      setEmail('');
      setName('');
      setPassword('');
      setRole('ASSOCIATE');
      setFormErr(null);
      setFormMsg('User created. They can sign in with the email and password you set.');
      void qc.invalidateQueries({ queryKey: ['admin-flight-detail', flightId] });
    },
    onError: (err: AxiosError<{ message?: string | string[] }>) => {
      setFormMsg(null);
      const m = err.response?.data?.message;
      const text = Array.isArray(m) ? m.join(' ') : m || err.message || 'Could not add user.';
      setFormErr(text);
    },
  });

  const submitAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    setFormErr(null);
    if (!email.trim() || !name.trim() || password.length < 8) return;
    addStaffM.mutate();
  };

  if (!flightId) {
    return (
      <main className="panel hero stack">
        <p className="muted">Missing flight id.</p>
        <Link className="nav-link" to="/admin/flights">
          ← Schedules
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="panel hero stack">
        <p className="muted" style={{ color: 'var(--danger)' }}>
          Could not load this flight (forbidden or not found).
        </p>
        <Link className="nav-link" to="/admin/flights">
          ← Schedules
        </Link>
      </main>
    );
  }

  const f = data?.flight;

  return (
    <main className="panel hero stack">
      <h1 className="page-title">Flight details</h1>
      <Link className="nav-link" to="/admin/flights">
        ← Schedules
      </Link>

      {isLoading && <p className="muted">Loading…</p>}

      {f && (
        <>
          <section className="stack card">
            <h2 className="page-title" style={{ fontSize: '1.05rem', margin: 0 }}>
              {f.flightNumber} · {f.origin} → {f.destination}
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              {f.airline.name} ({f.airline.code}) · block {f.durationMins} min · {f._count.schedules} schedule(s) ·{' '}
              {f._count.instances} instance(s)
            </p>
          </section>

          <section className="stack card" aria-labelledby="staff-heading">
            <h2 id="staff-heading" className="page-title" style={{ fontSize: '1rem', margin: 0 }}>
              Airline staff
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              Users linked to this flight’s airline. Superadmin and senior associates can add senior or associate
              accounts; associates can add associate accounts only.
            </p>
            <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 6 }}>
              {(data?.staff ?? []).map((s) => (
                <li key={s.id} className="card" style={{ padding: '10px 12px', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div className="muted" style={{ fontSize: '0.9rem' }}>
                    {s.email} · {s.role}
                  </div>
                </li>
              ))}
            </ul>
            {data?.staff?.length === 0 && <p className="muted">No staff yet besides any seeded users.</p>}
          </section>

          {canAddStaff && (
            <form className="stack card" onSubmit={submitAddStaff}>
              <h2 className="page-title" style={{ fontSize: '1rem', margin: 0 }}>
                Add staff user
              </h2>
              <label className="field">
                <span className="field-label">Email</span>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Display name</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">Password</span>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </label>
              {user?.role === 'SUPERADMIN' && (
                <label className="field">
                  <span className="field-label">Role</span>
                  <select className="input" value={role} onChange={(e) => setRole(e.target.value as StaffRoleOption)}>
                    <option value="ASSOCIATE">Associate</option>
                    <option value="SENIOR_ASSOCIATE">Senior associate</option>
                  </select>
                </label>
              )}
              {user?.role === 'SENIOR_ASSOCIATE' && (
                <p className="muted" style={{ margin: 0 }}>
                  New users are created as <strong>Associate</strong>. Only a superadmin can add another senior
                  associate.
                </p>
              )}
              {user?.role === 'ASSOCIATE' && (
                <p className="muted" style={{ margin: 0 }}>
                  New users will be created as <strong>Associate</strong> for this airline.
                </p>
              )}
              <button
                className="btn btn-primary"
                type="submit"
                disabled={addStaffM.isPending || !email.trim() || !name.trim() || password.length < 8}
              >
                Create staff login
              </button>
              {formErr && (
                <p className="muted" style={{ margin: 0, color: 'var(--danger)' }}>
                  {formErr}
                </p>
              )}
              {formMsg && <p className="muted" style={{ margin: 0 }}>{formMsg}</p>}
            </form>
          )}
        </>
      )}
    </main>
  );
}
