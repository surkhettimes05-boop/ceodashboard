import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../components/ui';

interface Customer { id: string; name: string; phone?: string | null; loyalty_points_balance: number | string; }
interface Transaction { id: string; type: string; points: number | string; balance_after: number | string; description: string; created_at: string; sale?: { sale_number: string } | null; }
interface Settings { pointsPerCurrency: number; currencyPerPoint: number; minimumRedeemPoints: number; pointsValue: number; active: boolean; }

export const LoyaltyView: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const { push } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [ledger, setLedger] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const canAdjust = user?.role === 'CEO' || user?.role === 'ADMIN' || user?.permissions.includes('LOYALTY_ADJUSTMENT');
  const canConfigure = user?.role === 'CEO' || user?.role === 'ADMIN' || user?.permissions.includes('LOYALTY_SETTINGS');

  const load = async () => {
    try {
      const [customerResponse, settingsResponse] = await Promise.all([
        api.get('/customers', { params: { search: '' } }),
        api.get('/loyalty/settings'),
      ]);
      setCustomers(customerResponse.data.data);
      setSettings(settingsResponse.data.data);
    } catch (error: any) {
      push({ title: 'Unable to load loyalty', description: error.response?.data?.message || 'Please try again.', tone: 'error' });
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!customerId) { setLedger([]); return; }
    api.get(`/loyalty/ledger/${customerId}`).then((response) => setLedger(response.data.data)).catch(() => setLedger([]));
  }, [customerId]);

  const adjust = async (delta: number) => {
    if (!customerId || !reason.trim() || !delta) return;
    try {
      await api.post('/loyalty/adjust', { customerId, points: delta, reason });
      setReason(''); setPoints('');
      const response = await api.get(`/loyalty/ledger/${customerId}`);
      setLedger(response.data.data);
      push({ title: 'Points adjusted', description: 'The adjustment was recorded in the loyalty ledger.', tone: 'success' });
    } catch (error: any) {
      push({ title: 'Adjustment failed', description: error.response?.data?.message || 'Unable to adjust points.', tone: 'error' });
    }
  };
  const redeem = async () => {
    const amount = Number(points);
    if (!customerId || !amount || !selected || amount > Number(selected.loyalty_points_balance) || amount < (settings?.minimumRedeemPoints ?? 100)) return;
    if (!window.confirm(`Redeem ${amount} points for this customer?`)) return;
    try {
      await api.post('/loyalty/redeem', { customerId, points: amount, description: 'POS/customer loyalty redemption' });
      setPoints('');
      const [customersResponse, ledgerResponse] = await Promise.all([api.get('/customers', { params: { search: '' } }), api.get(`/loyalty/ledger/${customerId}`)]);
      setCustomers(customersResponse.data.data);
      setLedger(ledgerResponse.data.data);
      push({ title: 'Points redeemed', description: 'The redemption was recorded in the ledger.', tone: 'success' });
    } catch (error: any) { push({ title: 'Redemption failed', description: error.response?.data?.message || 'Unable to redeem points.', tone: 'error' }); }
  };

  if (loading) return <div className="glass-panel" style={{ padding: 40 }}>Loading loyalty records...</div>;
  const selected = customers.find((customer) => customer.id === customerId);
  return <div>
    <div style={{ marginBottom: 24 }}><h1 style={{ color: 'var(--text-primary)' }}>Loyalty</h1><p style={{ color: 'var(--text-muted)' }}>Customer balances and auditable point history.</p></div>
    <div className="glass-panel" style={{ padding: 20, marginBottom: 20 }}>
      <label className="form-label" htmlFor="loyalty-customer">Customer</label>
      <select id="loyalty-customer" className="input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
        <option value="">Select a customer</option>
        {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} {customer.phone ? `(${customer.phone})` : ''}</option>)}
      </select>
      {selected && <div style={{ marginTop: 16, display: 'flex', gap: 24, flexWrap: 'wrap', color: 'var(--text-primary)' }}><strong>Available points: {Number(selected.loyalty_points_balance)}</strong><span>Minimum redemption: {settings?.minimumRedeemPoints ?? 100}</span></div>}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)', gap: 20 }}>
      <div className="glass-panel" style={{ padding: 20 }}><h2 style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>Loyalty history</h2><div className="table-container"><table className="custom-table"><thead><tr><th>Date</th><th>Type</th><th>Points</th><th>Sale</th><th>Balance</th><th>Description</th></tr></thead><tbody>{ledger.map((entry) => <tr key={entry.id}><td>{new Date(entry.created_at).toLocaleDateString()}</td><td>{entry.type}</td><td style={{ color: Number(entry.points) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{Number(entry.points) >= 0 ? '+' : ''}{Number(entry.points)}</td><td>{entry.sale?.sale_number || '-'}</td><td>{Number(entry.balance_after)}</td><td>{entry.description}</td></tr>)}{ledger.length === 0 && <tr><td colSpan={6}>Select a customer to view transactions.</td></tr>}</tbody></table></div></div>
      <div className="glass-panel" style={{ padding: 20 }}><h2 style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>Controls</h2>{user?.permissions.includes('LOYALTY_REDEEM') || user?.role === 'CEO' || user?.role === 'ADMIN' ? <><label className="form-label" htmlFor="redeem-points">Redeem points</label><input id="redeem-points" className="input" type="number" value={points} onChange={(event) => setPoints(event.target.value)} placeholder={`Minimum ${settings?.minimumRedeemPoints ?? 100}`} /><button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!customerId || !points} onClick={() => void redeem()}>Redeem points</button></> : null}{canAdjust ? <><label className="form-label" htmlFor="adjust-reason">Manual adjustment reason</label><input id="adjust-reason" className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for adjustment" /><button className="btn btn-secondary" style={{ marginTop: 12 }} disabled={!customerId || !reason || !points} onClick={() => void adjust(Number(points))}>Record adjustment</button></> : <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>Manual adjustments require loyalty adjustment permission.</p>}{canConfigure && settings && <div style={{ marginTop: 24, color: 'var(--text-muted)' }}>Current rule: 1 point per {settings.currencyPerPoint} currency units.</div>}</div>
    </div>
  </div>;
};
