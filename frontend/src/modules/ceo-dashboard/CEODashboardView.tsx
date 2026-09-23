import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSettings } from '../../contexts/SettingsContext';
import { formatNPR } from '../../lib/formatNpr';
import { useToast } from '../../components/ui';
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Building2,
  Calendar,
  AlertTriangle,
  FileText,
  UserCheck,
  ShoppingBag,
} from 'lucide-react';

interface ExecutiveDashboardData {
  financials: {
    sales: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
    grossMargin?: number;
    cashAndBank?: number;
    accountsReceivable?: number;
    accountsPayable?: number;
    inventoryAssetValue?: number;
    cashSales: number;
    digitalPayments: number;
    transactionCount: number;
    avgTransactionValue: number;
  };
  inventory: {
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalTrackedProducts: number;
  };
  channels: {
    retail: number;
    b2b: number;
    online: number;
  };
  branches: {
    branchName: string;
    sales: number;
    transactions: number;
  }[];
  customers: {
    totalCustomers: number;
    outstandingB2bReceivables: number;
  };
  customerLoyalty?: {
    customers: { total: number; new: number; active: number; loyaltyMembers: number; repeatCustomers: number; repeatPurchaseRate: number };
    loyalty: { totalPointsIssued: number; totalPointsRedeemed: number; outstandingPoints: number; avgBasket: number };
  };
}

export const CEODashboardView: React.FC = () => {
  const { settings } = useSettings();
  const { push } = useToast();
  const [range, setRange] = useState<string>('today');
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const money = (value: number) => formatNPR(value, { symbol: settings.currencySymbol });

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/dashboard', { params: { range } });
      setData(res.data.data);
    } catch (err: any) {
      push({ title: 'Dashboard unavailable', description: err.response?.data?.message || 'Unable to load dashboard metrics. Please try again.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [range]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>Chief Executive Officer Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Single Source of Truth business metrics derived directly from posted transactions and general ledger truth.
          </p>
        </div>

        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <Calendar size={16} color="var(--primary)" style={{ marginLeft: '8px' }} />
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontWeight: '600', padding: '6px 10px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="today" style={{ background: 'var(--bg-card)' }}>Today</option>
            <option value="yesterday" style={{ background: 'var(--bg-card)' }}>Yesterday</option>
            <option value="this_week" style={{ background: 'var(--bg-card)' }}>This Week</option>
            <option value="last_week" style={{ background: 'var(--bg-card)' }}>Last Week</option>
            <option value="this_month" style={{ background: 'var(--bg-card)' }}>This Month</option>
            <option value="last_month" style={{ background: 'var(--bg-card)' }}>Last Month</option>
            <option value="this_quarter" style={{ background: 'var(--bg-card)' }}>This Quarter</option>
            <option value="this_year" style={{ background: 'var(--bg-card)' }}>This Year</option>
            <option value="custom" style={{ background: 'var(--bg-card)' }}>Custom Range</option>
            <option value="all_time" style={{ background: 'var(--bg-card)' }}>All Time</option>
          </select>
        </div>
      </div>

      {loading || !data ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Computing executive KPIs from transactional data...
        </div>
      ) : (
        <>
          {/* Top Row: Executive Financial Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>REVENUE</span>
                <DollarSign size={20} color="var(--accent-emerald)" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }} className="font-mono">
                {money(data.financials.sales)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', marginTop: '4px' }}>
                {data.financials.transactionCount} transactions · {money(data.financials.avgTransactionValue)} avg
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>GROSS PROFIT</span>
                <TrendingUp size={20} color="var(--primary)" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }} className="font-mono">
                {money(data.financials.grossProfit)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Gross margin: {((data.financials.grossProfit / Math.max(data.financials.sales, 1)) * 100).toFixed(1)}%
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>OPERATING EXPENSES</span>
                <FileText size={20} color="var(--accent-amber)" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }} className="font-mono">
                {money(data.financials.operatingExpenses)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Period operating costs
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>OPERATING PROFIT</span>
                <DollarSign size={20} color="var(--accent-cyan)" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: data.financials.netProfit >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }} className="font-mono">
                {money(data.financials.netProfit)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Cash & bank: {money(data.financials.cashAndBank ?? 0)}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>CASH & BANK</span>
                <Users size={20} color="var(--accent-cyan)" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }} className="font-mono">
                {money(data.financials.cashAndBank ?? 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Ledger balances as of selected end date
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>AR</span>
                <UserCheck size={20} color="var(--accent-amber)" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }} className="font-mono">
                {money(data.financials.accountsReceivable ?? 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Outstanding customer receivables
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>AP</span>
                <Building2 size={20} color="var(--accent-rose)" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }} className="font-mono">
                {money(data.financials.accountsPayable ?? 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Outstanding supplier liabilities
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>INVENTORY ASSET VALUE</span>
                <Package size={20} color="var(--accent-purple)" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }} className="font-mono">
                {money(data.financials.inventoryAssetValue ?? data.inventory.totalValue)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                {data.inventory.totalTrackedProducts} tracked products
              </div>
            </div>
          </div>

          {/* Row 2: Detailed Performance Breakdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* Sales Channel Breakdown */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingBag size={18} color="var(--primary)" /> Revenue by Sales Channel
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Retail POS Store</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>POS Cashier Register Sales</div>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--accent-emerald)' }} className="font-mono">
                    {money(data.channels.retail)}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Wholesale B2B Sales</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Client Accounts & Credit Orders</div>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--accent-amber)' }} className="font-mono">
                    {money(data.channels.b2b)}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Online Webstore</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>E-Commerce Orders</div>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--accent-cyan)' }} className="font-mono">
                    {money(data.channels.online)}
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory Health & Low Stock Alerts */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="var(--accent-rose)" /> Inventory Health & Alerts
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', fontWeight: '700', marginBottom: '6px' }}>
                    LOW STOCK WARNINGS
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {data.inventory.lowStockCount}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Products below min stock</div>
                </div>

                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', fontWeight: '700', marginBottom: '6px' }}>
                    OUT OF STOCK ITEMS
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {data.inventory.outOfStockCount}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Zero inventory on hand</div>
                </div>
              </div>

              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Outstanding B2B Receivables (AR):</span>
                <span style={{ fontWeight: '800', color: 'var(--accent-amber)' }} className="font-mono">{money(data.customers.outstandingB2bReceivables)}</span>
              </div>
            </div>
          </div>

          {data.customerLoyalty && <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}><h3 style={{ color: 'var(--text-primary)' }}>Customer retention and loyalty</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}><div><small>Total customers</small><strong>{data.customerLoyalty.customers.total}</strong></div><div><small>Loyalty members</small><strong>{data.customerLoyalty.customers.loyaltyMembers}</strong></div><div><small>Repeat rate</small><strong>{(data.customerLoyalty.customers.repeatPurchaseRate * 100).toFixed(1)}%</strong></div><div><small>Outstanding points</small><strong>{data.customerLoyalty.loyalty.outstandingPoints}</strong></div></div></div>}

          {/* Row 3: Branch Performance Table */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} color="var(--accent-cyan)" /> Store Branch Performance
            </h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Branch Store Name</th>
                    <th>Transactions Completed</th>
                    <th>Total Branch Revenue (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.branches.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No sales transactions recorded for selected timeframe.
                      </td>
                    </tr>
                  ) : (
                    data.branches.map((b, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{b.branchName}</td>
                        <td>{b.transactions} Sales</td>
                        <td className="font-mono" style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--accent-emerald)' }}>
                          {money(b.sales)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
