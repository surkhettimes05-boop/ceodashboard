import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSettings } from '../../contexts/SettingsContext';
import { formatNPR } from '../../lib/formatNpr';
import { useToast } from '../../components/ui';
import { BookOpen, DollarSign, TrendingUp, CheckCircle, Scale, FileText } from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  description?: string | null;
}

interface LedgerEntry {
  id: string;
  debit: number;
  credit: number;
  created_at: string;
  account: { code: string; name: string; type: string };
  journal_entry: { entry_number: string; reference_type: string; description: string };
}

interface PnLReport {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
}

interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

export const AccountingView: React.FC = () => {
  const { settings } = useSettings();
  const { push } = useToast();
  const [activeTab, setActiveTab] = useState<'coa' | 'ledger' | 'pnl' | 'tb'>('coa');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [pnl, setPnl] = useState<PnLReport | null>(null);
  const [trialBalanceRows, setTrialBalanceRows] = useState<TrialBalanceRow[]>([]);
  const [tbTotals, setTbTotals] = useState<{ debit: number; credit: number; isBalanced: boolean }>({ debit: 0, credit: 0, isBalanced: true });
  const [loading, setLoading] = useState(true);

  const money = (value: number | string | null | undefined) => formatNPR(value ?? 0, { symbol: settings.currencySymbol });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [accRes, ledRes, pnlRes, tbRes] = await Promise.all([
        api.get('/accounts'),
        api.get('/ledger'),
        api.get('/reports/profit-loss'),
        api.get('/reports/trial-balance'),
      ]);
      setAccounts(accRes.data.data);
      setLedgerEntries(ledRes.data.data);
      setPnl(pnlRes.data.data);
      setTrialBalanceRows(tbRes.data.data.rows);
      setTbTotals({
        debit: tbRes.data.data.grandTotalDebit,
        credit: tbRes.data.data.grandTotalCredit,
        isBalanced: tbRes.data.data.isBalanced,
      });
    } catch (err: any) {
      push({ title: 'Accounting data unavailable', description: err.response?.data?.message || 'Unable to load accounting data. Please try again.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>Double-Entry Accounting & General Ledger</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Chart of Accounts, real-time double-entry posting ledger, Profit & Loss statement, and Trial Balance.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button className={`btn ${activeTab === 'coa' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('coa')}>
          <BookOpen size={18} />
          <span>Chart of Accounts</span>
        </button>
        <button className={`btn ${activeTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('ledger')}>
          <FileText size={18} />
          <span>General Ledger Log</span>
        </button>
        <button className={`btn ${activeTab === 'pnl' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('pnl')}>
          <TrendingUp size={18} />
          <span>Profit & Loss</span>
        </button>
        <button className={`btn ${activeTab === 'tb' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('tb')}>
          <Scale size={18} />
          <span>Trial Balance</span>
        </button>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading general ledger...
        </div>
      ) : activeTab === 'coa' ? (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account Name</th>
                  <th>Account Classification</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id}>
                    <td className="font-mono" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{acc.code}</td>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{acc.name}</td>
                    <td>
                      <span className={`badge ${
                        acc.type === 'ASSET'
                          ? 'badge-emerald'
                          : acc.type === 'LIABILITY'
                          ? 'badge-amber'
                          : acc.type === 'REVENUE'
                          ? 'badge-primary'
                          : 'badge-rose'
                      }`}>
                        {acc.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{acc.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'ledger' ? (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>JE #</th>
                  <th>Account</th>
                  <th>Description</th>
                  <th>Debit ({settings.currencySymbol})</th>
                  <th>Credit ({settings.currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No double-entry transactions posted yet.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((le) => (
                    <tr key={le.id}>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(le.created_at).toLocaleString()}
                      </td>
                      <td className="font-mono" style={{ color: 'var(--primary)' }}>{le.journal_entry?.entry_number}</td>
                      <td>
                        <span className="font-mono" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{le.account.code}</span> — {le.account.name}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{le.journal_entry?.description}</td>
                      <td className="font-mono" style={{ fontWeight: '700', color: Number(le.debit) > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                        {Number(le.debit) > 0 ? money(le.debit) : '-'}
                      </td>
                      <td className="font-mono" style={{ fontWeight: '700', color: Number(le.credit) > 0 ? 'var(--accent-purple)' : 'var(--text-muted)' }}>
                        {Number(le.credit) > 0 ? money(le.credit) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'pnl' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '20px' }}>
              Profit & Loss Statement
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Sales Revenue</span>
                <span style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--accent-emerald)' }} className="font-mono">
                  {money(pnl?.revenue ?? 0)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Cost of Goods Sold (COGS)</span>
                <span style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--accent-rose)' }} className="font-mono">
                  - {money(pnl?.cogs ?? 0)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-card-hover)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>GROSS PROFIT</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--primary)' }} className="font-mono">
                  {money(pnl?.grossProfit ?? 0)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Operating Expenses</span>
                <span style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--accent-amber)' }} className="font-mono">
                  - {money(pnl?.operatingExpenses ?? 0)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glow)' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>NET OPERATING PROFIT</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-emerald)' }} className="font-mono">
                  {money(pnl?.netProfit ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>Trial Balance Sheet</h2>
            {tbTotals.isBalanced ? (
              <span className="badge badge-emerald"><CheckCircle size={12} style={{ marginRight: '4px' }} /> Trial Balance Balanced</span>
            ) : (
              <span className="badge badge-rose">Unbalanced Trial Balance</span>
            )}
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th>Total Debits ({settings.currencySymbol})</th>
                  <th>Total Credits ({settings.currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {trialBalanceRows.map((row) => (
                  <tr key={row.code}>
                    <td className="font-mono" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{row.code}</td>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{row.name}</td>
                    <td><span className="badge badge-primary">{row.type}</span></td>
                    <td className="font-mono" style={{ fontWeight: '700' }}>{money(row.debit)}</td>
                    <td className="font-mono" style={{ fontWeight: '700' }}>{money(row.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-card-hover)', fontWeight: '800' }}>
                  <td colSpan={3} style={{ textAlign: 'right', padding: '14px 18px', color: 'var(--text-primary)' }}>GRAND TOTALS:</td>
                  <td className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--accent-emerald)' }}>{money(tbTotals.debit)}</td>
                  <td className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--accent-purple)' }}>{money(tbTotals.credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
