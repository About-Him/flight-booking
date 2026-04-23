import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/auth-context';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { data } = await client.post('/auth/register', { email, name, password });
    login(data.accessToken, data.user);
    navigate('/');
  }

  return (
    <main className="panel hero stack">
      <div>
        <h1 className="page-title" style={{ marginBottom: 6 }}>
          Create your account
        </h1>
        <p className="muted" style={{ margin: 0 }}>A few details — then you can search and book right away.</p>
      </div>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
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
            autoComplete="new-password"
          />
        </label>
        <button className="btn btn-primary" type="submit">
          Create account
        </button>
      </form>
      <p className="muted" style={{ margin: 0 }}>
        <Link to="/login">Already have an account?</Link>
      </p>
    </main>
  );
}
