import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui';
import { ShoppingBag, Plus, CheckCircle, Clock, Truck, Warehouse as WarehouseIcon } from 'lucide-react';

interface PurchaseItem {
  id: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  product: { sku: string; name: string };
}

interface Purchase {
  id: string;
  purchase_number: string;
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  total_amount: number;
  created_at: string;
  supplier: { id: string; name: string };
  warehouse: { id: string; name: string; code: string };
  purchase_items: PurchaseItem[];
}

export const PurchasesView: React.FC = () => {
  const { push } = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; cost_price: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lineItems, setLineItems] = useState<{ productId: string; quantity: number; unitCost: number }[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [poRes, supRes, whRes, prodRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/suppliers'),
        api.get('/warehouses'),
        api.get('/products'),
      ]);
      setPurchases(poRes.data.data);
      setSuppliers(supRes.data.data);
      setWarehouses(whRes.data.data);
      setProducts(prodRes.data.data);

      if (supRes.data.data.length > 0 && !supplierId) setSupplierId(supRes.data.data[0].id);
      if (whRes.data.data.length > 0 && !warehouseId) setWarehouseId(whRes.data.data[0].id);
    } catch (err: any) {
      push({ title: 'Purchasing data unavailable', description: err.response?.data?.message || 'Unable to load purchasing data. Please try again.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddLineItem = () => {
    if (products.length === 0) return;
    setLineItems([
      ...lineItems,
      { productId: products[0].id, quantity: 10, unitCost: Number(products[0].cost_price) },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      push({ title: 'Purchase order incomplete', description: 'Please add at least one line item to the purchase order.', tone: 'error' });
      return;
    }

    try {
      await api.post('/purchases', {
        supplierId,
        warehouseId,
        items: lineItems,
      });
      setShowModal(false);
      setLineItems([]);
      fetchData();
    } catch (err: any) {
      push({ title: 'Unable to create purchase order', description: err.response?.data?.message || 'Error creating purchase order', tone: 'error' });
    }
  };

  const handleReceivePO = async (purchaseId: string) => {
    try {
      await api.post(`/purchases/${purchaseId}/receive`);
      fetchData();
    } catch (err: any) {
      push({ title: 'Receive goods failed', description: err.response?.data?.message || 'Error receiving purchase order', tone: 'error' });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>Purchasing & Purchase Orders (PO)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Supplier procurement orders, Goods Receipt Note (GRN) receiving, and inventory intake.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); handleAddLineItem(); }}>
          <Plus size={18} />
          <span>Create Purchase Order</span>
        </button>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading purchase orders...
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Receiving Warehouse</th>
                  <th>Order Items</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No purchase orders found. Click "Create Purchase Order" to issue a PO to a supplier.
                    </td>
                  </tr>
                ) : (
                  purchases.map((po) => (
                    <tr key={po.id}>
                      <td className="font-mono" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{po.purchase_number}</td>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{po.supplier?.name}</td>
                      <td>
                        <span className="badge badge-primary">
                          <WarehouseIcon size={12} style={{ marginRight: '4px' }} />
                          {po.warehouse?.name}
                        </span>
                      </td>
                      <td>{po.purchase_items?.length || 0} Line Item(s)</td>
                      <td className="font-mono" style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-emerald)' }}>
                        ${Number(po.total_amount).toFixed(2)}
                      </td>
                      <td>
                        {po.status === 'ORDERED' ? (
                          <span className="badge badge-amber" style={{ display: 'inline-flex', gap: '4px' }}>
                            <Clock size={12} /> Ordered
                          </span>
                        ) : po.status === 'RECEIVED' ? (
                          <span className="badge badge-emerald" style={{ display: 'inline-flex', gap: '4px' }}>
                            <CheckCircle size={12} /> Received (GRN Posted)
                          </span>
                        ) : (
                          <span className="badge badge-primary">{po.status}</span>
                        )}
                      </td>
                      <td>
                        {po.status === 'ORDERED' && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            onClick={() => handleReceivePO(po.id)}
                          >
                            Receive Goods (GRN)
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>
              Create Purchase Order
            </h2>
            <form onSubmit={handleCreatePO}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Select Supplier</label>
                  <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Receiving Warehouse</label>
                  <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label">Order Items</label>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={handleAddLineItem}>
                    + Add Item Line
                  </button>
                </div>

                {lineItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <select
                      className="input"
                      value={item.productId}
                      onChange={(e) => {
                        const newItems = [...lineItems];
                        newItems[idx].productId = e.target.value;
                        const p = products.find(prod => prod.id === e.target.value);
                        if (p) newItems[idx].unitCost = Number(p.cost_price);
                        setLineItems(newItems);
                      }}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>

                    <input
                      className="input font-mono"
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...lineItems];
                        newItems[idx].quantity = parseFloat(e.target.value) || 0;
                        setLineItems(newItems);
                      }}
                    />

                    <input
                      className="input font-mono"
                      type="number"
                      step="0.01"
                      placeholder="Unit Cost"
                      value={item.unitCost}
                      onChange={(e) => {
                        const newItems = [...lineItems];
                        newItems[idx].unitCost = parseFloat(e.target.value) || 0;
                        setLineItems(newItems);
                      }}
                    />

                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '8px' }}
                      onClick={() => handleRemoveLineItem(idx)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Issue Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
