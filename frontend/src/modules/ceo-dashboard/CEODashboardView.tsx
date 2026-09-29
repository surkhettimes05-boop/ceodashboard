import React, { useEffect, useState } from 'react';
import { AlertTriangle, Building2, Calendar, Database, Package, ShoppingBag, Store } from 'lucide-react';
import { api } from '../../lib/api';
import { useSettings } from '../../contexts/SettingsContext';
import { formatNPR } from '../../lib/formatNpr';
import { useToast } from '../../components/ui';

type Metric<T> = { value: T | null; status: 'available' | 'unavailable'; provenance: { sourceSystem: string; apiOrReadModel: string; calculation: string } };
interface DailySummary {
  sales: { total: Metric<number>; store: Metric<number>; b2b: Metric<number>; online: Metric<number>; orderCount: Metric<number>; cancelledOrders: Metric<number>; byStore: Metric<Array<{ branchId: string | null; storeName: string; sales: number; orders: number }>> };
  inventory: { warehouse: Metric<{ totalUnits: number; productCount: number }>; store: Metric<{ totalUnits: number; productCount: number }>; lowStockProducts: Metric<number> };
  availability: { pasalho: 'available' | 'unavailable'; reason?: string };
}

export const CEODashboardView: React.FC = () => {
  const { settings } = useSettings();
  const { push } = useToast();
  const [range, setRange] = useState('today');
  const [data, setData] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const money = (value: number | null) => value === null ? 'Unavailable' : formatNPR(value, { symbol: settings.currencySymbol });

  useEffect(() => {
    setLoading(true);
    api.get('/reporting/daily-summary', { params: { range } })
      .then((response) => setData(response.data.data))
      .catch((error) => push({ title: 'Reporting unavailable', description: error.response?.data?.message || 'Unable to load the reporting summary.', tone: 'error' }))
      .finally(() => setLoading(false));
  }, [range, push]);

  const cards = data ? [
    ['Total sales', money(data.sales.total.value), ShoppingBag], ['Store sales', money(data.sales.store.value), Store],
    ['B2B sales', money(data.sales.b2b.value), Building2], ['Online sales', money(data.sales.online.value), ShoppingBag],
    ['Orders', data.sales.orderCount.value === null ? 'Unavailable' : String(data.sales.orderCount.value), Database],
    ['Low-stock products', data.inventory.lowStockProducts.value === null ? 'Unavailable' : String(data.inventory.lowStockProducts.value), AlertTriangle],
  ] as const : [];

  const sourceRows = data ? [
    ['Total sales', data.sales.total], ['Store sales', data.sales.store], ['B2B sales', data.sales.b2b], ['Online sales', data.sales.online],
    ['Warehouse inventory', data.inventory.warehouse], ['Store inventory', data.inventory.store], ['Low-stock products', data.inventory.lowStockProducts],
  ] as Array<[string, Metric<unknown>]> : [];

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
      <div><h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>CEO Reporting</h1><p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Daily summaries assembled from explicit store and Pasalho reporting sources.</p></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', padding: 6, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}><Calendar size={16} color="var(--primary)" style={{ marginLeft: 8 }} /><select value={range} onChange={(event) => setRange(event.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontWeight: 600, padding: '6px 10px', outline: 'none' }}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="this_week">This week</option><option value="this_month">This month</option></select></div>
    </div>
    {loading || !data ? <div className="glass-panel" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading reporting read models...</div> : <>
      {data.availability.pasalho === 'unavailable' && <div className="glass-panel" style={{ padding: 16, marginBottom: 20, border: '1px solid var(--accent-amber)', color: 'var(--accent-amber)' }}>Pasalho reporting is unavailable. Pasalho-owned metrics are shown as unavailable, never as zero. {data.availability.reason}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>{cards.map(([label, value, Icon]) => <div className="glass-panel" style={{ padding: 20 }} key={label}><Icon size={18} color="var(--primary)" /><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, marginTop: 14 }}>{label.toUpperCase()}</div><div className="font-mono" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>{value}</div></div>)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>
        <div className="glass-panel" style={{ padding: 24 }}><h3 style={{ color: 'var(--text-primary)', marginTop: 0 }}><Package size={18} /> Inventory summary</h3><p>Warehouse: <strong>{data.inventory.warehouse.value ? `${data.inventory.warehouse.value.totalUnits} units / ${data.inventory.warehouse.value.productCount} products` : 'Unavailable'}</strong></p><p>Stores: <strong>{data.inventory.store.value ? `${data.inventory.store.value.totalUnits} units / ${data.inventory.store.value.productCount} products` : 'Unavailable'}</strong></p></div>
        <div className="glass-panel" style={{ padding: 24 }}><h3 style={{ color: 'var(--text-primary)', marginTop: 0 }}><Store size={18} /> Sales by store</h3>{data.sales.byStore.value?.length ? data.sales.byStore.value.map((store) => <div key={store.branchId || store.storeName} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}><span>{store.storeName} ({store.orders})</span><strong className="font-mono">{money(store.sales)}</strong></div>) : <p style={{ color: 'var(--text-muted)' }}>No store sales for this period.</p>}</div>
      </div>
      <div className="glass-panel" style={{ padding: 24 }}><h3 style={{ color: 'var(--text-primary)', marginTop: 0 }}><Database size={18} /> Metric source map</h3><p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Every displayed value identifies its owning system, read model, and calculation.</p><div className="table-container"><table className="custom-table"><thead><tr><th>Metric</th><th>Source system</th><th>API / read model</th><th>Calculation</th></tr></thead><tbody>{sourceRows.map(([name, value]) => <tr key={name}><td>{name}</td><td>{value.provenance.sourceSystem}</td><td>{value.provenance.apiOrReadModel}</td><td>{value.provenance.calculation}</td></tr>)}</tbody></table></div></div>
    </>}
  </div>;
};
