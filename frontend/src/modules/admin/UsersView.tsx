import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui';
import { Users, UserPlus, Shield, CheckCircle, XCircle } from 'lucide-react';

interface UserItem {
  id: string;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  role: { name: string; description?: string };
  branch?: { name: string } | null;
  created_at: string;
}

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [roleName, setRoleName] = useState('CASHIER');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', {
        username,
        email,
        fullName,
        password,
        roleName,
      });
      setShowModal(false);
      setUsername('');
      setEmail('');
      setFullName('');
      setPassword('');
      fetchUsers();
    } catch (err: any) {
      push({ title: 'Unable to create user', description: err.response?.data?.message || 'Error creating user', tone: 'error' });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>User Accounts & Roles</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Manage system access, assign user roles, and enforce permissions.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <UserPlus size={18} />
          <span>Add New User</span>
        </button>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading user records...
        </div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--accent-rose)' }}>
          {error}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>User Profile</th>
                  <th>Role</th>
                  <th>Branch Location</th>
                  <th>Status</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{u.full_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        @{u.username} • {u.email}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-primary">
                        <Shield size={12} style={{ marginRight: '4px' }} />
                        {u.role.name}
                      </span>
                    </td>
                    <td>{u.branch?.name || 'Central / All Branches'}</td>
                    <td>
                      {u.is_active ? (
                        <span className="badge badge-emerald" style={{ display: 'inline-flex', gap: '4px' }}>
                          <CheckCircle size={12} /> Active
                        </span>
                      ) : (
                        <span className="badge badge-rose" style={{ display: 'inline-flex', gap: '4px' }}>
                          <XCircle size={12} /> Deactivated
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>
              Create New System User
            </h2>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. John Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="e.g. jdoe" />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="jdoe@startup.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Initial Password</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Minimum 6 characters" />
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Role</label>
                <select className="input" value={roleName} onChange={(e) => setRoleName(e.target.value)}>
                  <option value="CASHIER">CASHIER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ACCOUNTANT">ACCOUNTANT</option>
                  <option value="WAREHOUSE_MANAGER">WAREHOUSE_MANAGER</option>
                  <option value="B2B_SALES">B2B_SALES</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="CEO">Chief Executive Officer</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
