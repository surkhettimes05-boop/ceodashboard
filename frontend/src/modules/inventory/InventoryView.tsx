import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui';
import { Package, AlertTriangle, ArrowRightLeft, Plus, History, CheckCircle, Clock } from 'lucide-react';

interface StockBalance {
  id: string;
  location_type: string;
  location_id: string;
  quantity: number;
  is_low_stock: boolean;
  product: {
    id: string;
    sku: string;
    name: string;
    min_stock_level: number;
    category: { name: string };
    unit: { abbreviation: string };
  };
}

interface InventoryTx {
  id: string;
  movement_type: string;
  quantity: number;
  unit_cost: number;
  reference_type: string;
  reference_id: string;
  created_at: string;
  product: { sku: string; name: string };
  user: { username: string; full_name: string };
}

interface StockTransfer {
  id: string;
  transfer_number: string;
  source_location_id: string;
  destination_location_id: string;
  status: string;
  created_at: string;
  items: { quantity: number; product: { name: string } }[];
}

export const InventoryView: React.FC = () => {
  const { push } = useToast();
  const [activeTab, setActiveTab] = useState<'balances' | 'audit' | 'transfers'>('balances');
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [transactions, setTransactions] = useState<InventoryTx[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  // Adjustment Modal
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [adjProductId, setAdjProductId] = useState('');
  const [adjQty, setAdjQty] = useState('10');
  const [adjMovementType, setAdjMovementType] = useState<'OPENING_STOCK' | 'ADJUSTMENT' | 'DAMAGE'>('OPENING_STOCK');
  const [adjNotes, setAdjNotes] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [balRes, txRes, trRes, prodRes] = await Promise.all([
        api.get('/inventory/balances'),
        api.get('/inventory/transactions'),
        api.get('/inventory/transfers'),
        api.get('/products'),
      ]);
      setBalances(balRes.data.data);
      setTransactions(txRes.data.data);
      setTransfers(trRes.data.data);
      setProducts(prodRes.data.data);
      if (prodRes.data.data.length > 0 && !adjProductId) {
        setAdjProductId(prodRes.data.data[0].id);
      }
    } catch (err: any) {
      push({ title: 'Inventory data unavailable', description: err.response?.data?.message || 'Unable to load inventory data. Please try again.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory/adjustments', {
        productId: adjProductId,
        locationType: 'WAREHOUSE',
        locationId: 'WH-CENTRAL',
        quantity: parseFloat(adjQty),
        movementType: adjMovementType,
        notes: adjNotes,
      });
      setShowAdjModal(false);
      setAdjNotes('');
      fetchData();
    } catch (err: any) {
      push({ title: 'Stock adjustment failed', description: err.response?.data?.message || 'Error recording stock adjustment', tone: 'error' });
    }
  };

  const handleReceiveTransfer = async (transferId: string) => {
    try {
      await api.post(`/inventory/transfers/${transferId}/receive`);
      fetchData();
    } catch (err: any) {
      push({ title: 'Transfer receive failed', description: err.response?.data?.message || 'Error receiving transfer', tone: 'error' });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>Inventory Engine & Stock Ledger</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Multi-location stock balances, immutable transaction movement logs, and stock transfers.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => setShowAdjModal(true)}>
            <Plus size={18} />
            <span>Record Stock Adjustment</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          className={`btn ${activeTab === 'balances' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('balances')}
        >
          <Package size={18} />
          <span>Stock Balances</span>
        </button>
        <button
          className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('audit')}
        >
          <History size={18} />
          <span>Movement Audit Trail</span>
        </button>
        <button
          className={`btn ${activeTab === 'transfers' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('transfers')}
        >
          <ArrowRightLeft size={18} />
          <span>Stock Transfers</span>
        </button>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading stock engine...
        </div>
      ) : activeTab === 'balances' ? (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Product SKU & Name</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Current Stock</th>
                  <th>Min Stock Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No stock balance records found. Click "Record Stock Adjustment" to initialize opening stock.
                    </td>
                  </tr>
                ) : (
                  balances.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{b.product.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }} className="font-mono">{b.product.sku}</div>
                      </td>
                      <td>
                        <span className="badge badge-primary">{b.product.category.name}</span>
                      </td>
                      <td>{b.location_id}</td>
                      <td className="font-mono" style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {Number(b.quantity).toFixed(0)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.product.unit.abbreviation}</span>
                      </td>
                      <td className="font-mono" style={{ color: 'var(--text-muted)' }}>
                        {b.product.min_stock_level}
                      </td>
                      <td>
                        {b.is_low_stock ? (
                          <span className="badge badge-rose" style={{ display: 'inline-flex', gap: '4px' }}>
                            <AlertTriangle size={12} /> Low Stock Alert
                          </span>
                        ) : (
                          <span className="badge badge-emerald" style={{ display: 'inline-flex', gap: '4px' }}>
                            <CheckCircle size={12} /> Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'audit' ? (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Product</th>
                  <th>Movement Type</th>
                  <th>Quantity</th>
                  <th>Unit Cost</th>
                  <th>Reference</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{tx.product.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }} className="font-mono">{tx.product.sku}</div>
                    </td>
                    <td>
                      <span className={`badge ${
                        tx.movement_type.includes('IN') || tx.movement_type === 'OPENING_STOCK'
                          ? 'badge-emerald'
                          : tx.movement_type === 'DAMAGE'
                          ? 'badge-rose'
                          : 'badge-primary'
                      }`}>
                        {tx.movement_type}
                      </span>
                    </td>
                    <td className="font-mono" style={{
                      fontWeight: '700',
                      color: Number(tx.quantity) > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                    }}>
                      {Number(tx.quantity) > 0 ? `+${Number(tx.quantity)}` : Number(tx.quantity)}
                    </td>
                    <td className="font-mono">${Number(tx.unit_cost).toFixed(2)}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {tx.reference_type}: {tx.reference_id}
                    </td>
                    <td>{tx.user?.full_name || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Transfer #</th>
                  <th>Source Location</th>
                  <th>Destination Location</th>
                  <th>Items Count</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No stock transfers recorded.
                    </td>
                  </tr>
                ) : (
                  transfers.map((tr) => (
                    <tr key={tr.id}>
                      <td className="font-mono" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{tr.transfer_number}</td>
                      <td>{tr.source_location_id}</td>
                      <td>{tr.destination_location_id}</td>
                      <td>{tr.items.length} Product(s)</td>
                      <td>
                        {tr.status === 'IN_TRANSIT' ? (
                          <span className="badge badge-amber" style={{ display: 'inline-flex', gap: '4px' }}>
                            <Clock size={12} /> In Transit
                          </span>
                        ) : (
                          <span className="badge badge-emerald" style={{ display: 'inline-flex', gap: '4px' }}>
                            <CheckCircle size={12} /> Completed
                          </span>
                        )}
                      </td>
                      <td>
                        {tr.status === 'IN_TRANSIT' && (
                          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => handleReceiveTransfer(tr.id)}>
                            Receive Stock
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdjModal && (
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
              Record Stock Adjustment / Intake
            </h2>
            <form onSubmit={handleAdjustmentSubmit}>
              <div className="form-group">
                <label className="form-label">Select Product</label>
                <select className="input" value={adjProductId} onChange={(e) => setAdjProductId(e.target.value)} required>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Movement Type</label>
                  <select className="input" value={adjMovementType} onChange={(e) => setAdjMovementType(e.target.value as any)}>
                    <option value="OPENING_STOCK">OPENING_STOCK</option>
                    <option value="ADJUSTMENT">ADJUSTMENT</option>
                    <option value="DAMAGE">DAMAGE (Reduction)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input className="input font-mono" type="number" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} required />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Audit Notes</label>
                <input className="input" value={adjNotes} onChange={(e) => setAdjNotes(e.target.value)} placeholder="Physical count verification..." />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Post Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
