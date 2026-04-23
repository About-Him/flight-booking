import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const { data } = await client.post('/auth/login', { email, password });
      login(data.accessToken, data.user);
      navigate('/');
    } catch {
      setError('Could not log in.');
    }
  }

  return (
    <main className="panel hero stack">
      <div>
        <h1 className="page-title" style={{ marginBottom: 6 }}>
          Welcome back
        </h1>
        <p className="muted" style={{ margin: 0 }}>Sign in to book seats and manage your trips.</p>
      </div>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="muted" style={{ margin: 0 }}>{error}</p>}
        <button className="btn btn-primary" type="submit">
          Continue
        </button>
      </form>
      <p className="muted" style={{ margin: 0 }}>
        <Link to="/register">Create an account</Link>
      </p>
    </main>
  );
}
