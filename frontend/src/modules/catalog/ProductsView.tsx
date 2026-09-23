import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSettings } from '../../contexts/SettingsContext';
import { SelectField } from '../../components/ui';
import { formatNPR } from '../../lib/formatNpr';
import { Package, Plus, Search, Tag, Barcode, DollarSign } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
}

interface Product {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  cost_price: number;
  selling_price: number;
  wholesale_price?: number | null;
  min_stock_level: number;
  is_active: boolean;
  category: Category;
  unit: Unit;
}

export const ProductsView: React.FC = () => {
  const { settings } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [formError, setFormError] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [costPrice, setCostPrice] = useState('10.00');
  const [sellingPrice, setSellingPrice] = useState('20.00');
  const [wholesalePrice, setWholesalePrice] = useState('16.00');
  const [openingStock, setOpeningStock] = useState('25');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, unitRes] = await Promise.all([
        api.get('/products', { params: { search, categoryId: selectedCategory || undefined } }),
        api.get('/categories'),
        api.get('/units'),
      ]);

      const nextCategories = Array.isArray(catRes.data?.data) ? catRes.data.data : [];
      const nextUnits = Array.isArray(unitRes.data?.data) ? unitRes.data.data : [];
      const nextProducts = Array.isArray(prodRes.data?.data) ? prodRes.data.data : [];

      console.log('Catalog lookup payload', {
        products: nextProducts.length,
        categories: nextCategories,
        units: nextUnits,
      });

      setProducts(nextProducts);
      setCategories(nextCategories);
      setUnits(nextUnits);

      if (nextCategories.length === 0) {
        console.warn('No categories returned from /api/categories. Seed defaults or create categories first.');
      }
      if (nextUnits.length === 0) {
        console.warn('No units returned from /api/units. Seed defaults or create units first.');
      }

    } catch (err: any) {
      console.error('Error fetching catalog data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, selectedCategory]);

  const marginPct = React.useMemo(() => {
    const cost = Number(costPrice) || 0;
    const selling = Number(sellingPrice) || 0;
    if (!selling || !cost) return 0;
    return ((selling - cost) / selling) * 100;
  }, [costPrice, sellingPrice]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId) {
      setFormError('Please select a category before saving.');
      return;
    }

    if (!unitId) {
      setFormError('Please select a unit of measure before saving.');
      return;
    }

    setFormError('');

    try {
      await api.post('/products', {
        sku,
        barcode: barcode || undefined,
        name,
        categoryId,
        unitId,
        costPrice: parseFloat(costPrice),
        sellingPrice: parseFloat(sellingPrice),
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : undefined,
        openingStock: parseFloat(openingStock) || 0,
      });
      setShowModal(false);
      setSku('');
      setBarcode('');
      setName('');
      setCategoryId('');
      setUnitId('');
      setOpeningStock('25');
      fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Error creating product');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>Product Catalog Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Manage master product inventory items, SKUs, barcode lookups, and retail/wholesale prices.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          <span>Add New Product</span>
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            className="input"
            placeholder="Search products by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-dim)' }} />
        </div>

        <div style={{ width: '220px' }}>
          <SelectField
            label="Category filter"
            value={selectedCategory}
            onValueChange={(value) => setSelectedCategory(value)}
            placeholder="All Categories"
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading products catalog...
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>SKU & Barcode</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>UoM</th>
                  <th>Cost Price</th>
                  <th>Selling Price</th>
                  <th>Wholesale B2B</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No products found. Click "Add New Product" to seed your catalog.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }} className="font-mono">{p.sku}</div>
                        {p.barcode && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }} className="font-mono">
                            <Barcode size={12} style={{ marginRight: '4px' }} /> {p.barcode}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{p.name}</td>
                      <td>
                        <span className="badge badge-primary">{p.category.name}</span>
                      </td>
                      <td>
                        <span className="badge badge-emerald">{p.unit.abbreviation}</span>
                      </td>
                      <td className="font-mono" style={{ color: 'var(--text-muted)' }}>
                        {formatNPR(p.cost_price, { symbol: settings.currencySymbol })}
                      </td>
                      <td className="font-mono" style={{ fontWeight: '700', color: 'var(--accent-emerald)' }}>
                        {formatNPR(p.selling_price, { symbol: settings.currencySymbol })}
                      </td>
                      <td className="font-mono" style={{ color: 'var(--accent-purple)' }}>
                        {p.wholesale_price ? formatNPR(p.wholesale_price, { symbol: settings.currencySymbol }) : 'N/A'}
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '32px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>
              Add Product to Catalog
            </h2>
            <form onSubmit={handleCreateProduct}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">SKU</label>
                  <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} required placeholder="PRD-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Barcode (Optional)</label>
                  <input className="input" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="123456789" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Organic Coffee Beans 1kg" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <SelectField
                    label="Category"
                    value={categoryId || ''}
                    placeholder="Select category"
                    onValueChange={(value) => {
                      setCategoryId(value);
                      setFormError('');
                    }}
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </div>
                <div className="form-group">
                  <SelectField
                    label="Unit of Measure"
                    value={unitId || ''}
                    placeholder="Select unit"
                    onValueChange={(value) => {
                      setUnitId(value);
                      setFormError('');
                    }}
                    options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.abbreviation})` }))}
                  />
                </div>
              </div>

              {formError && (
                <div style={{ marginBottom: '16px', color: '#fda4af', fontSize: '0.85rem', fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Cost Price</label>
                  <input className="input font-mono" type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price</label>
                  <input className="input font-mono" type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening Stock</label>
                  <input className="input font-mono" type="number" min="0" step="1" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Wholesale B2B</label>
                  <input className="input font-mono" type="number" step="0.01" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} />
                </div>
              </div>

              {Number(sellingPrice) > 0 && (
                <div style={{ marginBottom: '18px', padding: '10px 12px', borderRadius: '8px', background: marginPct >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)', border: `1px solid ${marginPct >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`, color: marginPct >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontSize: '0.8rem', fontWeight: 700 }}>
                  Margin: {Math.abs(marginPct).toFixed(1)}% {marginPct >= 0 ? 'healthy' : 'below cost'}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
