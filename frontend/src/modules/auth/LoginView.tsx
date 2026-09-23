import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Lock, User, AlertCircle, ShieldCheck } from 'lucide-react';

export const LoginView: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { username, password });
      if (response.data.data.mfaRequired) {
        setMfaChallenge(response.data.data.challengeToken);
        return;
      }
      const { user, tokens } = response.data.data;
      setAuth(user, tokens.accessToken, tokens.refreshToken);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge) return;
    setError(null);
    setLoading(true);
    try {
      const response = await api.post('/auth/mfa/verify', { challengeToken: mfaChallenge, token: mfaToken });
      const { user, tokens } = response.data.data;
      setAuth(user, tokens.accessToken, tokens.refreshToken);
    } catch (err: any) {
      setError(err.response?.data?.message || 'MFA verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (userType: 'admin' | 'cashier' | 'ceo' | 'accountant') => {
    if (userType === 'cashier') {
      setUsername('cashier');
      setPassword('Cashier123!');
    } else if (userType === 'admin') {
      setUsername('admin');
      setPassword('Admin123!');
    } else if (userType === 'ceo') {
      setUsername('ceo');
      setPassword('Admin123!');
    } else if (userType === 'accountant') {
      setUsername('accountant');
      setPassword('Admin123!');
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top left, #1e1b4b, #0b0f19 70%)',
      padding: '24px'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, var(--primary), var(--accent-cyan))',
            borderRadius: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 0 25px rgba(99, 102, 241, 0.4)'
          }}>
            <ShieldCheck size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
            Startup ERP + POS & Accounting
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Sign in to access your business portal
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fda4af',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {mfaChallenge ? <form onSubmit={handleMfaSubmit}>
          <div className="form-group">
            <label className="form-label">Authenticator code</label>
            <input className="input" inputMode="numeric" autoComplete="one-time-code" value={mfaToken} onChange={(e) => setMfaToken(e.target.value)} required autoFocus />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading || !mfaToken} style={{ width: '100%', padding: '14px', fontSize: '1rem' }}>
            {loading ? 'Verifying...' : 'Verify and Sign In'}
          </button>
        </form> : <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username or Email</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ paddingLeft: '42px' }}
              />
              <User size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-dim)' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: '42px' }}
              />
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-dim)' }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
          >
            {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
          </button>
        </form>}

        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', marginBottom: '12px' }}>
            QUICK LOGIN DEMO ACCOUNTS
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '8px' }} onClick={() => handleQuickLogin('ceo')}>
              Chief Executive Officer
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '8px' }} onClick={() => handleQuickLogin('cashier')}>
              POS Cashier
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '8px' }} onClick={() => handleQuickLogin('accountant')}>
              Accountant
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '8px' }} onClick={() => handleQuickLogin('admin')}>
              Sys Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
