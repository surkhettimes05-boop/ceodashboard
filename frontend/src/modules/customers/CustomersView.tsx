import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSettings } from '../../contexts/SettingsContext';
import { formatNPR } from '../../lib/formatNpr';
import { useToast } from '../../components/ui';
import { Users, UserPlus, Building, DollarSign } from 'lucide-react';

interface Customer {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  is_b2b: boolean;
  credit_limit: number;
  outstanding_balance: number;
  created_at: string;
  loyalty_points_balance?: number | string;
  lifetime_spend?: number | string;
  total_orders?: number;
}

interface LoyaltyEntry { id: string; type: string; points: number | string; balance_after: number | string; created_at: string; sale?: { sale_number: string } | null; }

export const CustomersView: React.FC = () => {
  const { settings } = useSettings();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();
  const money = (value: number) => formatNPR(value, { symbol: settings.currencySymbol });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isB2b, setIsB2b] = useState(false);
  const [creditLimit, setCreditLimit] = useState('0');
  const [profile, setProfile] = useState<Customer | null>(null);
  const [profileLedger, setProfileLedger] = useState<LoyaltyEntry[]>([]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/customers');
      setCustomers(res.data.data);
    } catch (err: any) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openProfile = async (customer: Customer) => {
    try {
      const [summaryResponse, ledgerResponse] = await Promise.all([
        api.get(`/customers/${customer.id}/loyalty`),
        api.get(`/loyalty/ledger/${customer.id}`),
      ]);
      setProfile({ ...customer, ...summaryResponse.data.data });
      setProfileLedger(ledgerResponse.data.data);
    } catch (error: any) {
      push({ title: 'Unable to load loyalty profile', description: error.response?.data?.message || 'Please try again.', tone: 'error' });
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/customers', {
        code,
        name,
        phone,
        email,
        isB2b,
        creditLimit: parseFloat(creditLimit),
      });
      setShowModal(false);
      setCode('');
      setName('');
      setPhone('');
      setEmail('');
      setIsB2b(false);
      setCreditLimit('0');
      fetchCustomers();
    } catch (err: any) {
      push({ title: 'Unable to save customer', description: err.response?.data?.message || 'Error creating customer', tone: 'error' });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>Customer & B2B Directory</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Manage retail customers, wholesale B2B client credit limits, and contact records.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <UserPlus size={18} />
          <span>Add New Customer</span>
        </button>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading customers...
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Customer Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Contact Info</th>
                  <th>Credit Limit</th>
                  <th>Outstanding Balance</th>
                  <th>Loyalty</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No customer records found.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id}>
                      <td className="font-mono" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{c.code}</td>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{c.name}</td>
                      <td>
                        {c.is_b2b ? (
                          <span className="badge badge-amber">B2B Wholesale</span>
                        ) : (
                          <span className="badge badge-primary">Retail</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {c.phone && <div>📞 {c.phone}</div>}
                        {c.email && <div>✉️ {c.email}</div>}
                      </td>
                      <td className="font-mono" style={{ color: 'var(--accent-cyan)' }}>
                        {money(Number(c.credit_limit))}
                      </td>
                      <td className="font-mono" style={{ color: Number(c.outstanding_balance) > 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                        {money(Number(c.outstanding_balance))}
                      </td>
                      <td><button type="button" className="btn btn-secondary" onClick={() => void openProfile(c)}>View loyalty</button></td>
                    </tr>
                  ))
                )}
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
              Add Customer Record
            </h2>
            <form onSubmit={handleCreateCustomer}>
              <div className="form-group">
                <label className="form-label">Customer Code</label>
                <input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="CUST-001" />
              </div>
              <div className="form-group">
                <label className="form-label">Customer / Business Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Acme Retailing Inc." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555-0199" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@acme.com" />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0' }}>
                <input
                  type="checkbox"
                  id="b2b-check"
                  checked={isB2b}
                  onChange={(e) => setIsB2b(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                />
                <label htmlFor="b2b-check" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer' }}>
                  Enable B2B Wholesale Customer Account
                </label>
              </div>

              {isB2b && (
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label className="form-label">Approved B2B Credit Limit ({settings.currencySymbol})</label>
                  <input className="input font-mono" type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="50000" />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {profile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}><div><h2 style={{ color: 'var(--text-primary)', marginTop: 0 }}>{profile.name}</h2><p style={{ color: 'var(--text-muted)' }}>{profile.phone || 'No phone number'}</p></div><button type="button" className="btn btn-secondary" onClick={() => setProfile(null)}>Close</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, margin: '20px 0' }}><div><small>Loyalty balance</small><strong>{Number(profile.loyalty_points_balance || 0)} points</strong></div><div><small>Points earned</small><strong>{profileLedger.filter((entry) => entry.type === 'EARN').reduce((sum, entry) => sum + Math.max(0, Number(entry.points)), 0)}</strong></div><div><small>Points redeemed</small><strong>{Math.abs(profileLedger.filter((entry) => entry.type === 'REDEEM').reduce((sum, entry) => sum + Number(entry.points), 0))}</strong></div><div><small>Total visits</small><strong>{profile.total_orders || 0}</strong></div><div><small>Lifetime spend</small><strong>{money(Number(profile.lifetime_spend || 0))}</strong></div></div>
            <h3 style={{ color: 'var(--text-primary)' }}>Recent loyalty transactions</h3><div className="table-container"><table className="custom-table"><thead><tr><th>Date</th><th>Type</th><th>Points</th><th>Sale</th><th>Balance</th></tr></thead><tbody>{profileLedger.slice(0, 10).map((entry) => <tr key={entry.id}><td>{new Date(entry.created_at).toLocaleDateString()}</td><td>{entry.type}</td><td>{Number(entry.points) >= 0 ? '+' : ''}{Number(entry.points)}</td><td>{entry.sale?.sale_number || '-'}</td><td>{Number(entry.balance_after)}</td></tr>)}{profileLedger.length === 0 && <tr><td colSpan={5}>No loyalty transactions yet.</td></tr>}</tbody></table></div>
          </div>
        </div>
      )}
    </div>
  );
};
