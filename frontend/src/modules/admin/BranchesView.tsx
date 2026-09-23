import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui';
import { Building2, Warehouse as WarehouseIcon, Plus, CheckCircle } from 'lucide-react';

interface Branch {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  is_active: boolean;
  warehouses: { id: string; name: string; is_central: boolean }[];
}

export const BranchesView: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/branches');
      setBranches(res.data.data);
    } catch (err: any) {
      console.error('Error fetching branches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/branches', { code, name, address, phone });
      setShowModal(false);
      setCode('');
      setName('');
      setAddress('');
      setPhone('');
      fetchBranches();
    } catch (err: any) {
      push({ title: 'Unable to save branch', description: err.response?.data?.message || 'Error creating branch', tone: 'error' });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>Branches & Warehouses</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Multi-branch retail store locations and central warehouse network.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          <span>Add New Branch</span>
        </button>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading store network...
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Branch Code</th>
                  <th>Store / Branch Name</th>
                  <th>Address & Phone</th>
                  <th>Associated Warehouses</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td className="font-mono" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{b.code}</td>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{b.name}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <div>{b.address || 'No address specified'}</div>
                      <div>{b.phone}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {b.warehouses.length === 0 ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>None</span>
                        ) : (
                          b.warehouses.map((w) => (
                            <span key={w.id} className={`badge ${w.is_central ? 'badge-amber' : 'badge-primary'}`}>
                              <WarehouseIcon size={12} style={{ marginRight: '4px' }} />
                              {w.name} {w.is_central ? '(Central)' : ''}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-emerald">
                        <CheckCircle size={12} style={{ marginRight: '4px' }} /> Operational
                      </span>
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
              Add Retail Branch Location
            </h2>
            <form onSubmit={handleCreateBranch}>
              <div className="form-group">
                <label className="form-label">Branch Code</label>
                <input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="BR-NORTH" />
              </div>
              <div className="form-group">
                <label className="form-label">Branch Store Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Northside Mini-Mart Branch" />
              </div>
              <div className="form-group">
                <label className="form-label">Physical Address</label>
                <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="45 North Avenue" />
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Contact Phone</label>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555-0188" />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
