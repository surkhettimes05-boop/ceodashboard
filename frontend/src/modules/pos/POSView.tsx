import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useSettings } from '../../contexts/SettingsContext';
import { formatNPR } from '../../lib/formatNpr';
import { useToast } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Printer,
  Barcode,
  Keyboard,
  Sparkles,
} from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  selling_price: number;
  category: { name: string };
  unit: { abbreviation: string };
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

interface Customer {
  id: string;
  name: string;
  code: string;
  phone?: string | null;
  loyalty_points_balance?: number | string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface PaymentSummary {
  grandTotal: number;
  transactionCount: number;
  byMethod: Record<string, { amount: number; transactionCount: number }>;
}

const PAYMENT_METHODS = ['CASH', 'CARD', 'MOBILE_MONEY', 'CREDIT'] as const;

export const POSView: React.FC = () => {
  const { settings } = useSettings();
  const user = useAuthStore((state) => state.user);
  const { push } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSummary, setCustomerSummary] = useState<any | null>(null);
  const [pointsPreview, setPointsPreview] = useState<{ points: number; settings: { currencyPerPoint: number; pointsValue: number; minimumRedeemPoints: number } } | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState('0');
  const [redemptionPoints, setRedemptionPoints] = useState('');
  const [redemptionConfirmed, setRedemptionConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'MOBILE_MONEY' | 'CREDIT'>('CASH');
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [checkoutConnectivityError, setCheckoutConnectivityError] = useState(false);
  const checkoutLockRef = useRef(false);
  const checkoutIdempotencyKeyRef = useRef<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const discountInputRef = useRef<HTMLInputElement | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, custRes, brRes] = await Promise.all([
        api.get('/products', { params: { search: search || undefined } }),
        api.get('/customers', { params: { search: customerSearch || undefined } }),
        api.get('/branches'),
      ]);
      setProducts(prodRes.data.data);
      setCustomers(custRes.data.data);
      setBranches(brRes.data.data);

      if (brRes.data.data.length > 0 && !selectedBranchId) {
        setSelectedBranchId(user?.branchId || brRes.data.data[0].id);
      }
    } catch (err: any) {
      push({ title: 'POS data unavailable', description: err.response?.data?.message || 'Unable to load products, customers, or branches.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, customerSearch]);

  useEffect(() => {
    if (!selectedCustomerId) { setCustomerSummary(null); return; }
    api.get(`/customers/${selectedCustomerId}/loyalty`).then((response) => setCustomerSummary(response.data.data)).catch((err) => {
      setCustomerSummary(null);
      push({ title: 'Customer loyalty unavailable', description: err.response?.data?.message || 'Unable to load this customer loyalty summary.', tone: 'error' });
    });
  }, [selectedCustomerId]);

  const fetchPaymentSummary = async () => {
    try {
      const response = await api.get('/sales/summary/payment-methods', {
        params: { branchId: selectedBranchId || undefined },
      });
      setPaymentSummary(response.data.data);
    } catch {
      setPaymentSummary(null);
      push({ title: 'Sales summary unavailable', description: 'Unable to refresh today\'s payment summary.', tone: 'error' });
    }
  };

  useEffect(() => {
    if (!selectedBranchId) return;
    void fetchPaymentSummary();
    const refreshTimer = window.setInterval(() => void fetchPaymentSummary(), 30000);
    return () => window.clearInterval(refreshTimer);
  }, [selectedBranchId, user?.role]);

  const createPosCustomer = async () => {
    try {
      const response = await api.post('/customers/pos-create', { phone: newCustomerPhone, name: newCustomerName });
      setSelectedCustomerId(response.data.data.id);
      setCustomerSearch(response.data.data.phone || newCustomerPhone);
      setCustomers((currentCustomers) => [response.data.data, ...currentCustomers.filter((customer) => customer.id !== response.data.data.id)]);
      setNewCustomerName('');
      setNewCustomerPhone('');
      push({ title: 'Customer created', description: 'The customer is ready for this sale.', tone: 'success' });
    } catch (error: any) {
      push({ title: 'Customer creation failed', description: error.response?.data?.message || 'Unable to create customer.', tone: 'error' });
    }
  };

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);

  const removeCustomer = () => {
    setSelectedCustomerId('');
    setCustomerSummary(null);
    setPointsPreview(null);
    setRedemptionPoints('');
    setRedemptionConfirmed(false);
  };

  const confirmRedemption = () => {
    const amount = Number(redemptionPoints);
    const balance = Number(customerSummary?.loyalty_points_balance || 0);
    const minimum = pointsPreview?.settings.minimumRedeemPoints || 100;
    if (!amount || amount < minimum || amount > balance) {
      push({ title: 'Invalid redemption', description: `Enter between ${minimum} and ${balance} points.`, tone: 'error' });
      return;
    }
    if (window.confirm(`Redeem ${amount} points for ${money(amount * (pointsPreview?.settings.pointsValue || 1))}?`)) setRedemptionConfirmed(true);
  };

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const addToCart = (product: Product) => {
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.product.id === product.id);
      if (existing) {
        return currentCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [...currentCart, { product, quantity: 1, unitPrice: Number(product.selling_price) }];
    });
    setScanError(null);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((currentCart) => currentCart.filter((item) => item.product.id !== productId));
  };

  const money = (value: number) => formatNPR(value, { symbol: settings.currencySymbol });
  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const manualDiscount = Number.parseFloat(discountAmount) || 0;
  const redemptionValue = redemptionConfirmed && pointsPreview ? Number(redemptionPoints || 0) * pointsPreview.settings.pointsValue : 0;
  const discount = manualDiscount + redemptionValue;
  const total = Math.max(0, subtotal - discount);

  useEffect(() => {
    if (!selectedCustomerId || !cart.length || total <= 0) { setPointsPreview(null); return; }
    let active = true;
    api.get('/loyalty/preview', { params: { amount: total } })
      .then((response) => { if (active) setPointsPreview(response.data.data); })
      .catch((err) => {
        if (active) setPointsPreview(null);
        push({ title: 'Loyalty preview unavailable', description: err.response?.data?.message || 'Unable to calculate loyalty points for this sale.', tone: 'error' });
      });
    return () => { active = false; };
  }, [selectedCustomerId, total, cart.length]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;

    return products.filter((product) => {
      const name = product.name.toLowerCase();
      const sku = product.sku.toLowerCase();
      const barcode = (product.barcode || '').toLowerCase();
      return name.includes(query) || sku.includes(query) || barcode.includes(query);
    });
  }, [products, search]);

  const findProductByIdentifier = (value: string) => {
    const raw = value.trim();
    if (!raw) return null;

    const normalized = raw.toLowerCase();
    const exactMatches = products.filter((product) => {
      const barcode = (product.barcode || '').toLowerCase();
      return barcode === normalized || product.sku.toLowerCase() === normalized;
    });
    if (exactMatches.length === 1) return exactMatches[0];
    if (exactMatches.length > 1) return null;

    const caseSensitiveNameMatches = products.filter((product) => product.name === raw);
    if (caseSensitiveNameMatches.length === 1) return caseSensitiveNameMatches[0];

    const nameMatches = products.filter((product) => product.name.toLowerCase() === normalized);
    return nameMatches.length === 1 ? nameMatches[0] : null;
  };

  const handleBarcodeSearch = () => {
    const value = search.trim();
    if (!value) return;

    const product = findProductByIdentifier(value);
    if (product) {
      addToCart(product);
      setSearch('');
      return;
    }

    const matchingProducts = products.filter((product) => product.name.toLowerCase() === value.toLowerCase());
    setScanError(matchingProducts.length > 1 ? 'Multiple products match that name. Scan or enter the exact SKU.' : 'Product not found');
    setSearch('');
  };

  const focusSearch = () => searchInputRef.current?.focus();

  const cyclePaymentMethod = () => {
    const currentIndex = PAYMENT_METHODS.indexOf(paymentMethod);
    const nextMethod = PAYMENT_METHODS[(currentIndex + 1) % PAYMENT_METHODS.length];
    setPaymentMethod(nextMethod);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? '';
      const isTyping = Boolean(target && (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable));

      if ((event.key === 'F2' || (event.key === '/' && !isTyping)) && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        focusSearch();
      }

      if (event.key === 'F4' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        document.getElementById('pos-customer-select')?.click();
      }

      if (event.key === 'F6' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        cyclePaymentMethod();
      }

      if (event.key === 'F8' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        discountInputRef.current?.focus();
      }

      if (event.key === 'F10' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        if (cart.length > 0) {
          void handleCheckout();
        }
      }

      if (event.key === 'Escape') {
        if (completedSale) {
          setCompletedSale(null);
        } else if (!isTyping) {
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, completedSale, isProcessing, paymentMethod]);

  const handleCheckout = async () => {
    if (checkoutLockRef.current || isProcessing) return;
    if (cart.length === 0) {
      push({ title: 'Cart is empty', description: 'Add at least one product before checkout.', tone: 'error' });
      return;
    }
    if (!selectedBranchId) {
      push({ title: 'Branch required', description: 'Please select a branch location before completing the sale.', tone: 'error' });
      return;
    }
    if (total <= 0) {
      push({ title: 'Invalid total', description: 'The sale total must be greater than zero.', tone: 'error' });
      return;
    }

    checkoutLockRef.current = true;
    setIsProcessing(true);
    try {
      const idempotencyKey = checkoutIdempotencyKeyRef.current || crypto.randomUUID();
      checkoutIdempotencyKeyRef.current = idempotencyKey;
      const payload = {
        branchId: selectedBranchId,
        customerId: selectedCustomerId || undefined,
        loyaltyRedemptionPoints: redemptionConfirmed ? Number(redemptionPoints) : 0,
        channel: 'RETAIL',
        discountAmount: discount,
        taxAmount: 0,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        payments: [
          {
            paymentMethod,
            amount: total,
          },
        ],
      };

      const res = await api.post('/sales', payload, { headers: { 'Idempotency-Key': idempotencyKey } });
      setCompletedSale(res.data.data);
      setCheckoutConnectivityError(false);
      checkoutIdempotencyKeyRef.current = null;
      setCart([]);
      setDiscountAmount('0');
      setRedemptionPoints('');
      setRedemptionConfirmed(false);
      void fetchPaymentSummary();
      push({ title: 'Checkout complete', description: `${res.data.data.sale_number} was saved successfully.`, tone: 'success' });
    } catch (err: any) {
      const isOffline = (typeof navigator !== 'undefined' && !navigator.onLine)
        || err.code === 'ERR_NETWORK'
        || (!err.response && Boolean(err.request));
      setCheckoutConnectivityError(isOffline);
      const message = isOffline
        ? 'No connection to the server. The sale was not completed. Check your connection and retry.'
        : err.response?.data?.message || err.message || 'Unable to complete the sale right now.';
      push({ title: 'Checkout failed', description: message, tone: 'error' });
    } finally {
      checkoutLockRef.current = false;
      setIsProcessing(false);
    }
  };

  return (
    <div className="pos-shell">
      <section className="pos-main-panel">
        <div className="pos-toolbar">
          <div className="pos-search-wrap">
            <Search size={18} className="pos-search-icon" />
            <input
              ref={searchInputRef}
              className="pos-search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleBarcodeSearch();
                }
              }}
              placeholder="Scan barcode or search products..."
              aria-label="Scan barcode or search products"
            />
          </div>

          <div className="pos-toolbar-actions">
            <span className="pos-keycap">F2 search</span>
            <span className="pos-keycap">F4 customer</span>
            <span className="pos-keycap">F10 pay</span>
          </div>
        </div>

        {scanError && (
          <div className="pos-alert" role="alert">
            <span>{scanError}</span>
            <button type="button" className="pos-inline-button" onClick={() => { setScanError(null); focusSearch(); }}>
              Search manually
            </button>
          </div>
        )}

        {checkoutConnectivityError && (
          <div className="pos-alert" role="alert">
            Checkout was not completed because the server could not be reached. Confirm connectivity before retrying.
          </div>
        )}

        {loading ? (
          <div className="pos-loading-state">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="pos-empty-products">
            <div className="pos-empty-products__icon"><Search size={24} /></div>
            <h3>No products match your search.</h3>
            <p>Try a different barcode, SKU, or product name.</p>
          </div>
        ) : (
          <div className="pos-product-grid">
            {filteredProducts.map((product) => (
              <button
                type="button"
                key={product.id}
                className="pos-product-card"
                onClick={() => addToCart(product)}
              >
                <div className="pos-product-card__meta">
                  <span className="pos-sku">{product.sku}</span>
                  <span className="pos-badge">{product.unit.abbreviation}</span>
                </div>
                <div className="pos-product-card__name">{product.name}</div>
                <div className="pos-product-card__footer">
                  <span className="pos-stock">{product.category?.name || 'General'}</span>
                  <strong>{money(Number(product.selling_price))}</strong>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="pos-cart-panel">
        <div className="pos-cart-header">
          <div className="pos-cart-title">
            <ShoppingCart size={18} />
            <span>Cart</span>
            <span className="pos-cart-count">{cart.reduce((total, item) => total + item.quantity, 0)}</span>
          </div>
          {cart.length > 0 && (
            <button type="button" className="pos-clear-cart" onClick={() => setCart([])}>
              Clear
            </button>
          )}
        </div>

        <section className="pos-sales-summary" aria-labelledby="pos-sales-summary-title">
          <div className="pos-sales-summary__header">
            <div>
              <span className="pos-field-label">Today so far</span>
              <h2 id="pos-sales-summary-title">Sales summary</h2>
            </div>
            <span className="pos-sales-summary__count">{paymentSummary?.transactionCount || 0} transactions</span>
          </div>
          <div className="pos-sales-summary__grid">
            {[
              { id: 'CASH', label: 'Cash' },
              { id: 'CARD', label: 'Card' },
              { id: 'MOBILE_MONEY', label: 'Mobile Money' },
              { id: 'CREDIT', label: 'Store Credit' },
            ].map((method) => (
              <div className="pos-sales-summary__row" key={method.id}>
                <span>{method.label}</span>
                <strong>{money(paymentSummary?.byMethod[method.id]?.amount || 0)}</strong>
              </div>
            ))}
          </div>
          <div className="pos-sales-summary__total">
            <span>Grand total</span>
            <strong>{money(paymentSummary?.grandTotal || 0)}</strong>
          </div>
        </section>

        {cart.length === 0 ? (
          <div className="pos-empty-state">
            <div className="pos-empty-state__icon"><ShoppingCart size={32} /></div>
            <h3>Cart is empty</h3>
            <p>Scan a barcode or select a product to add it to the cart.</p>
          </div>
        ) : (
          <div className="pos-cart-list">
            {cart.map((item) => (
              <div key={item.product.id} className="pos-cart-item">
                <div className="pos-cart-item__details">
                  <div className="pos-cart-item__name">{item.product.name}</div>
                  <div className="pos-cart-item__meta">{money(item.unitPrice)} each</div>
                </div>

                <div className="pos-cart-item__actions">
                  <div className="pos-qty-controls">
                    <button type="button" className="pos-stepper" onClick={() => updateQuantity(item.product.id, -1)} aria-label={`Decrease quantity for ${item.product.name}`}>
                      <Minus size={12} />
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" className="pos-stepper" onClick={() => updateQuantity(item.product.id, 1)} aria-label={`Increase quantity for ${item.product.name}`}>
                      <Plus size={12} />
                    </button>
                  </div>
                  <button type="button" className="pos-remove-item" onClick={() => removeFromCart(item.product.id)} aria-label={`Remove ${item.product.name}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pos-checkout-panel">
          <div className="pos-field-group">
            <label className="pos-field-label">Customer</label>
            <input id="pos-customer-select" className="input" value={customerSearch} onChange={(event) => { const value = event.target.value; setCustomerSearch(value); const match = customers.find((customer) => customer.phone === value || customer.name === value); if (match) setSelectedCustomerId(match.id); else if (selectedCustomer) removeCustomer(); }} placeholder="Search customer by phone" list="pos-customers" />
            <datalist id="pos-customers">{customers.map((customer) => <option key={customer.id} value={customer.phone || customer.name}>{customer.name} {customer.phone ? `(${customer.phone})` : ''}</option>)}</datalist>
            <select className="input" value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
              <option value="">{customerSearch ? 'Select matching customer' : 'Walk-in Customer'}</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} {customer.phone ? `(${customer.phone})` : ''} · {Number(customer.loyalty_points_balance || 0)} pts</option>)}
            </select>
            {selectedCustomer && customerSummary ? <div style={{ marginTop: 8, color: 'var(--text-primary)', fontSize: 13 }}><strong>{customerSummary.name}</strong><div>{customerSummary.phone || 'No phone'}</div><div style={{ marginTop: 6 }}><strong>Loyalty</strong><br />Current balance: {Number(customerSummary.loyalty_points_balance)} points</div><button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={removeCustomer}>Remove customer</button></div> : <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 13 }}>Walk-in Customer. Select a matching customer to attach loyalty to this sale.</div>}
            {selectedCustomer && pointsPreview && cart.length > 0 && <div style={{ marginTop: 10, color: 'var(--text-primary)', fontSize: 13 }}><strong>Loyalty preview</strong><div>Current points: {Number(customerSummary?.loyalty_points_balance || 0)}</div><div>Points from this purchase: +{pointsPreview.points}</div><div>Expected balance: {Number(customerSummary?.loyalty_points_balance || 0) + pointsPreview.points}</div></div>}
            {selectedCustomer && Number(customerSummary?.loyalty_points_balance || 0) >= (pointsPreview?.settings.minimumRedeemPoints || 100) && <div style={{ marginTop: 10, color: 'var(--text-primary)', fontSize: 13 }}><strong>Available redemption: {Number(customerSummary?.loyalty_points_balance)} points</strong><input className="input" type="number" value={redemptionPoints} onChange={(event) => { setRedemptionPoints(event.target.value); setRedemptionConfirmed(false); }} placeholder={`Minimum ${pointsPreview?.settings.minimumRedeemPoints || 100}`} /><button type="button" className="btn btn-secondary" style={{ marginTop: 6 }} onClick={confirmRedemption}>{redemptionConfirmed ? 'Redemption confirmed' : 'Redeem points'}</button>{redemptionConfirmed && <div style={{ marginTop: 6 }}>Discount value: {money(redemptionValue)} · Remaining: {Number(customerSummary?.loyalty_points_balance) - Number(redemptionPoints)} points</div>}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginTop: 8 }}>
              <input className="input" value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} placeholder="New name" />
              <input className="input" value={newCustomerPhone} onChange={(event) => setNewCustomerPhone(event.target.value)} placeholder="Phone" />
              <button type="button" className="btn btn-secondary" disabled={!newCustomerName || !newCustomerPhone} onClick={() => void createPosCustomer()}>Add</button>
            </div>
          </div>

          <div className="pos-field-group">
            <label className="pos-field-label">Payment method</label>
            <div className="pos-payment-grid">
              {[
                { id: 'CASH', label: 'Cash', icon: '💵' },
                { id: 'CARD', label: 'Card', icon: '💳' },
                { id: 'MOBILE_MONEY', label: 'Mobile Money', icon: '📱' },
                { id: 'CREDIT', label: 'Store Credit', icon: '📝' },
              ].map((method) => (
                <button
                  key={method.id}
                  type="button"
                  className={`pos-payment-button ${paymentMethod === method.id ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod(method.id as 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'CREDIT')}
                >
                  <span>{method.icon}</span>
                  <span>{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pos-summary">
            <div className="pos-summary-row">
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <div className="pos-summary-row">
              <span>Discount</span>
              <div className="pos-discount-input-wrap">
                <input
                  ref={discountInputRef}
                  className="pos-discount-input"
                  type="number"
                  value={discountAmount}
                  onChange={(event) => setDiscountAmount(event.target.value)}
                  aria-label="Discount amount"
                />
              </div>
            </div>
            <div className="pos-summary-row pos-summary-row--muted">
              <span>Tax</span>
              <strong>{money(0)}</strong>
            </div>
            <div className="pos-summary-divider" />
            <div className="pos-total-row">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="pos-checkout-button"
            disabled={cart.length === 0 || isProcessing}
            onClick={() => { void handleCheckout(); }}
          >
            {isProcessing ? 'Processing Transaction...' : `Complete checkout ${money(total)}`}
          </button>
        </div>
      </aside>

      {completedSale && (
        <div className="pos-receipt-modal">
          <div className="pos-receipt-card">
            <div className="pos-receipt-header">
              <CheckCircle size={42} color="#10b981" />
              <div>
                <h3>Startup Retail Store</h3>
                <p>POS Transaction Receipt</p>
                <span>{completedSale.sale_number}</span>
              </div>
            </div>

            <div className="pos-receipt-meta">
              <span>Date</span>
              <strong>{new Date(completedSale.created_at).toLocaleString()}</strong>
            </div>
            <div className="pos-receipt-meta">
              <span>Cashier</span>
              <strong>{user?.fullName}</strong>
            </div>

            <table className="pos-receipt-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {completedSale.sale_items?.map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.product?.name || 'Product'}</td>
                    <td>{Number(item.quantity)}</td>
                    <td>{money(Number(item.subtotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pos-receipt-total">
              <span>Total paid</span>
              <strong>{money(Number(completedSale.total_amount))}</strong>
            </div>

            {completedSale.loyaltyInfo && <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}><strong>LOYALTY</strong><div className="pos-receipt-meta"><span>Points earned</span><strong>+{completedSale.loyaltyInfo.pointsEarned}</strong></div>{completedSale.loyaltyInfo.pointsRedeemed > 0 && <div className="pos-receipt-meta"><span>Points redeemed</span><strong>-{completedSale.loyaltyInfo.pointsRedeemed}</strong></div>}<div className="pos-receipt-meta"><span>Previous balance</span><strong>{completedSale.loyaltyInfo.previousBalance} points</strong></div><div className="pos-receipt-meta"><span>Current balance</span><strong>{completedSale.loyaltyInfo.currentBalance} points</strong></div></div>}
            <div className="pos-receipt-actions">
              <button type="button" className="pos-modal-secondary" onClick={() => setCompletedSale(null)}>
                Close
              </button>
              <button type="button" className="pos-modal-primary" onClick={() => { window.print(); setCompletedSale(null); }}>
                <Printer size={16} />
                Print receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
