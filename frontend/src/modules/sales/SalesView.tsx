import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { useSettings } from '../../contexts/SettingsContext';
import { formatNPR } from '../../lib/formatNpr';
import { useToast } from '../../components/ui';
import {
  Search,
  RefreshCw,
  Eye,
  X,
  ShoppingCart,
  Calendar,
  DollarSign,
  CreditCard,
  Smartphone,
  Banknote,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

// Raw shape returned by the Prisma-backed backend (snake_case + nested)
interface RawSale {
  id: string;
  sale_number: string;
  channel: string;
  status: string;
  total_amount: number | string;
  tax_amount: number | string;
  discount_amount: number | string;
  subtotal: number | string;
  cashier_id: string;
  cashier?: { full_name: string; username: string } | null;
  branch?: { name: string; code: string } | null;
  customer?: { name: string; code: string } | null;
  notes?: string | null;
  created_at: string;
  sale_items?: {
    id: string;
    quantity: number | string;
    unit_price: number | string;
    subtotal: number | string;
    product?: { name: string; sku: string } | null;
  }[];
  sale_payments?: {
    payment_method: string;
    amount: number | string;
  }[];
}

// UI-friendly shape
interface Sale {
  id: string;
  saleNumber: string;
  channel: string;
  status: string;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  cashierName: string;
  branchName: string;
  customerName: string;
  notes: string;
  createdAt: string;
  items: { id: string; productName: string; sku: string; quantity: number; unitPrice: number; subtotal: number }[];
  payments: { method: string; amount: number }[];
}

const n = (v: number | string | undefined) => Number(v ?? 0);

function mapSale(r: RawSale): Sale {
  const sub = n(r.subtotal);
  const disc = n(r.discount_amount);
  const tax = n(r.tax_amount);
  return {
    id: r.id,
    saleNumber: r.sale_number,
    channel: r.channel,
    status: r.status,
    totalAmount: n(r.total_amount),
    taxAmount: tax,
    discountAmount: disc,
    netAmount: n(r.total_amount),
    cashierName: r.cashier?.full_name || r.cashier?.username || '—',
    branchName: r.branch?.name || '—',
    customerName: r.customer?.name || '',
    notes: r.notes || '',
    createdAt: r.created_at,
    items: (r.sale_items || []).map(si => ({
      id: si.id,
      productName: si.product?.name || 'Unknown',
      sku: si.product?.sku || '—',
      quantity: n(si.quantity),
      unitPrice: n(si.unit_price),
      subtotal: n(si.subtotal),
    })),
    payments: (r.sale_payments || []).map(sp => ({
      method: sp.payment_method,
      amount: n(sp.amount),
    })),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const channelColors: Record<string, string> = {
  RETAIL: 'var(--accent-emerald)',
  B2B: 'var(--accent-amber)',
  ONLINE: 'var(--accent-cyan)',
};

const statusColors: Record<string, string> = {
  COMPLETED: 'var(--accent-emerald)',
  PENDING: 'var(--accent-amber)',
  REFUNDED: 'var(--accent-rose)',
  PARTIAL_REFUND: 'var(--accent-purple)',
};

const paymentIcon = (method: string) => {
  switch (method) {
    case 'CASH': return <Banknote size={14} />;
    case 'CARD': return <CreditCard size={14} />;
    case 'MOBILE': return <Smartphone size={14} />;
    default: return <DollarSign size={14} />;
  }
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ─── Receipt Modal ────────────────────────────────────────────────────────────

const ReceiptModal: React.FC<{ saleId: string; onClose: () => void }> = ({ saleId, onClose }) => {
  const { settings } = useSettings();
  const { push } = useToast();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const fmt = (n: number) => formatNPR(n, { symbol: settings.currencySymbol });

  useEffect(() => {
    api.get(`/sales/${saleId}`)
      .then(r => setSale(mapSale(r.data.data as RawSale)))
      .catch((err) => push({ title: 'Sale details unavailable', description: err.response?.data?.message || 'Unable to load sale details.', tone: 'error' }))
      .finally(() => setLoading(false));
  }, [saleId]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Sale Receipt
            </h2>
            {sale && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                {sale.saleNumber}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading receipt...</div>
        ) : !sale ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--accent-rose)' }}>Failed to load sale.</div>
        ) : (
          <div style={{ overflowY: 'auto', padding: '28px' }}>
            {/* Meta row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: '700', marginBottom: '4px' }}>DATE & TIME</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>{fmtDate(sale.createdAt)}</div>
              </div>
              <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: '700', marginBottom: '4px' }}>CHANNEL</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: channelColors[sale.channel] || '#fff' }}>{sale.channel}</div>
              </div>
              <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: '700', marginBottom: '4px' }}>STATUS</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: statusColors[sale.status] || '#fff' }}>{sale.status}</div>
              </div>
            </div>

            {sale.customerName && (
              <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={16} color="var(--primary)" />
                <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{sale.customerName}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>(Customer)</span>
              </div>
            )}

            {/* Line Items */}
            <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
              Items Sold
            </h3>
            <div className="table-container" style={{ marginBottom: '20px' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(sale.items || []).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.productName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{item.sku}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '700' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(item.unitPrice)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: 'var(--accent-emerald)' }}>{fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px' }}>
              {[
                { label: 'Subtotal', value: fmt(sale.totalAmount), muted: true },
                { label: 'Tax', value: fmt(sale.taxAmount), muted: true },
                { label: 'Discount', value: `- ${fmt(sale.discountAmount)}`, muted: true },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <span>{row.label}</span>
                  <span style={{ fontFamily: 'monospace' }}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0 0', marginTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '1.05rem' }}>NET TOTAL</span>
                <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '1.2rem', color: 'var(--accent-emerald)' }}>{fmt(sale.netAmount)}</span>
              </div>
            </div>

            {/* Payments */}
            <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
              Payment Methods
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(sale.payments || []).map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontWeight: '600' }}>
                    {paymentIcon(p.method)}
                    {p.method}
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-primary)' }}>{fmt(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main SalesView ───────────────────────────────────────────────────────────

export const SalesView: React.FC = () => {
  const { settings } = useSettings();
  const { push } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const fmt = (n: number) => formatNPR(n, { symbol: settings.currencySymbol });
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/sales');
      setSales((res.data.data as RawSale[] || []).map(mapSale));
    } catch (err) {
      push({ title: 'Sales history unavailable', description: (err as any).response?.data?.message || 'Unable to load sales history. Please try again.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const filtered = sales.filter(s => {
    const matchSearch =
      !search ||
      s.saleNumber?.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      s.cashierName?.toLowerCase().includes(search.toLowerCase());
    const matchChannel = channelFilter === 'ALL' || s.channel === channelFilter;
    const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchSearch && matchChannel && matchStatus;
  });

  // Summary stats
  const totalRevenue = filtered.reduce((s, t) => s + Number(t.netAmount), 0);
  const completed = filtered.filter(s => s.status === 'COMPLETED').length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>Sales History & Invoices</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Complete audit trail of every transaction — POS, B2B, and online.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchSales} style={{ gap: '8px' }}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'TOTAL TRANSACTIONS', value: filtered.length, icon: <ShoppingCart size={18} color="var(--primary)" />, color: 'var(--text-primary)' },
          { label: 'NET REVENUE', value: fmt(totalRevenue), icon: <DollarSign size={18} color="var(--accent-emerald)" />, color: 'var(--accent-emerald)' },
          { label: 'COMPLETED', value: completed, icon: <CheckCircle size={18} color="var(--accent-cyan)" />, color: 'var(--accent-cyan)' },
          { label: 'PENDING / OTHER', value: filtered.length - completed, icon: <Clock size={18} color="var(--accent-amber)" />, color: 'var(--accent-amber)' },
        ].map(stat => (
          <div key={stat.label} className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>{stat.label}</span>
              {stat.icon}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: stat.color, fontFamily: 'monospace' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1', minWidth: '220px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-dim)' }} />
          <input
            className="input"
            style={{ paddingLeft: '38px' }}
            placeholder="Search by receipt #, customer, cashier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ width: 'auto', minWidth: '150px' }}
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value)}
        >
          <option value="ALL">All Channels</option>
          <option value="RETAIL">Retail POS</option>
          <option value="B2B">B2B Wholesale</option>
          <option value="ONLINE">Online</option>
        </select>
        <select
          className="input"
          style={{ width: 'auto', minWidth: '150px' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="PENDING">Pending</option>
          <option value="REFUNDED">Refunded</option>
          <option value="PARTIAL_REFUND">Partial Refund</option>
        </select>
        {(search || channelFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '8px 14px' }}
            onClick={() => { setSearch(''); setChannelFilter('ALL'); setStatusFilter('ALL'); }}
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Sales Table */}
      {loading ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <div>Loading transactions...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
          <AlertCircle size={40} color="var(--text-dim)" style={{ marginBottom: '16px' }} />
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No Sales Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {sales.length === 0
              ? 'No transactions have been recorded yet. Use the POS to create your first sale.'
              : 'No transactions match your current filters.'}
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date & Time</th>
                <th>Channel</th>
                <th>Customer</th>
                <th>Cashier / Rep</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Net Amount</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sale => (
                <tr key={sale.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--primary)', fontSize: '0.85rem' }}>
                      {sale.saleNumber}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <Calendar size={13} />
                      {fmtDate(sale.createdAt)}
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: `${channelColors[sale.channel] || '#999'}22`,
                      color: channelColors[sale.channel] || '#999',
                      border: `1px solid ${channelColors[sale.channel] || '#999'}44`,
                      fontSize: '0.72rem',
                    }}>
                      {sale.channel}
                    </span>
                  </td>
                  <td>
                    {sale.customerName ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: '600' }}>
                        <Users size={13} color="var(--text-dim)" />
                        {sale.customerName}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Walk-in</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {sale.cashierName || '—'}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      fontSize: '0.75rem', fontWeight: '700',
                      color: statusColors[sale.status] || '#fff',
                      background: `${statusColors[sale.status] || '#fff'}18`,
                      padding: '4px 10px', borderRadius: '20px',
                      border: `1px solid ${statusColors[sale.status] || '#fff'}33`,
                    }}>
                      <CheckCircle size={11} />
                      {sale.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '1rem', color: 'var(--accent-emerald)' }}>
                      {fmt(sale.netAmount)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '7px 14px', fontSize: '0.8rem' }}
                      onClick={() => setSelectedSaleId(sale.id)}
                      title="View Receipt"
                    >
                      <Eye size={14} /> Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: '12px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          Showing {filtered.length} of {sales.length} transactions
        </div>
      )}

      {/* Receipt Modal */}
      {selectedSaleId && (
        <ReceiptModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
      )}
    </div>
  );
};
