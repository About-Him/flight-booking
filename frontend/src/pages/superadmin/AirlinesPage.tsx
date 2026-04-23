import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import client from '../../api/client';

type CreateAirlineResponse = {
  airline: { id: string; name: string; code: string };
  seniorAssociate: { id: string; email: string; name: string; role: string };
};

export default function AirlinesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [srEmail, setSrEmail] = useState('');
  const [srPassword, setSrPassword] = useState('');
  const [srName, setSrName] = useState('');
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['superadmin-airlines'],
    queryFn: async () => {
      const res = await client.get('/superadmin/airlines');
      return res.data as Array<{ id: string; name: string; code: string; _count: { flights: number; staff: number } }>;
    },
  });

  const createM = useMutation({
    mutationFn: async () => {
      const res = await client.post<CreateAirlineResponse>('/superadmin/airlines', {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        seniorAssociateEmail: srEmail.trim(),
        seniorAssociatePassword: srPassword,
        ...(srName.trim() ? { seniorAssociateName: srName.trim() } : {}),
      });
      return res.data;
    },
    onSuccess: (res) => {
      setName('');
      setCode('');
      setSrEmail('');
      setSrPassword('');
      setSrName('');
      setFormErr(null);
      setFormMsg(
        `Created ${res.airline.name} (${res.airline.code}). Senior associate can log in as ${res.seniorAssociate.email}.`,
      );
      void qc.invalidateQueries({ queryKey: ['superadmin-airlines'] });
    },
    onError: (err: AxiosError<{ message?: string | string[] }>) => {
      setFormMsg(null);
      const m = err.response?.data?.message;
      const text = Array.isArray(m) ? m.join(' ') : m || err.message || 'Could not create airline.';
      setFormErr(text);
    },
  });

  const canSubmit =
    name.trim().length > 0 &&
    code.trim().length >= 2 &&
    srEmail.trim().length > 0 &&
    srPassword.length >= 8;

  return (
    <main className="panel hero stack">
      <h1 className="page-title">Airlines</h1>
      <Link className="nav-link" to="/admin">
        ← Admin
      </Link>

      <form
        className="stack card"
        onSubmit={(e) => {
          e.preventDefault();
          setFormMsg(null);
          setFormErr(null);
          if (canSubmit) createM.mutate();
        }}
      >
        <h2 className="page-title" style={{ fontSize: '1rem', margin: 0 }}>
          New airline
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Creates the airline and a <strong>senior associate</strong> staff login in one step (same as register: password
          at least 8 characters).
        </p>
        <label className="field">
          <span className="field-label">Airline name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" />
        </label>
        <label className="field">
          <span className="field-label">IATA / airline code</span>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={3}
            placeholder="FB"
            autoComplete="off"
          />
        </label>
        <h3 className="page-title" style={{ fontSize: '0.95rem', margin: '8px 0 0' }}>
          Senior associate login
        </h3>
        <label className="field">
          <span className="field-label">Email</span>
          <input
            className="input"
            type="email"
            value={srEmail}
            onChange={(e) => setSrEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="input"
            type="password"
            value={srPassword}
            onChange={(e) => setSrPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
          />
        </label>
        <label className="field">
          <span className="field-label">Display name (optional)</span>
          <input
            className="input"
            value={srName}
            onChange={(e) => setSrName(e.target.value)}
            placeholder={`Default: “${name.trim() || 'Airline'} Senior Associate”`}
            autoComplete="name"
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={!canSubmit || createM.isPending}>
          Add airline + senior associate
        </button>
        {formErr && (
          <p className="muted" style={{ margin: 0, color: 'var(--danger)' }}>
            {formErr}
          </p>
        )}
        {formMsg && <p className="muted" style={{ margin: 0 }}>{formMsg}</p>}
      </form>

      <div className="stack">
        {(data ?? []).map((a) => (
          <div key={a.id} className="card">
            <div style={{ fontWeight: 600 }}>
              {a.name} ({a.code})
            </div>
            <div className="muted">
              Flights {a._count.flights} · Staff {a._count.staff}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
