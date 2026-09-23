import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, CheckboxField, DataTable, EmptyState, Input, MoneyInput, Modal, PageHeader, SelectField, Skeleton, StatCard, StatusPill, SwitchField, Tabs, Toast, Tooltip } from '../components/ui';
import { formatNPR } from '../lib/formatNpr';
import { applyTheme, getInitialTheme, ThemeMode } from '../lib/theme';
import './design-system.css';

const tableRows = [
  { product: 'Rice 5kg', customer: 'Milan Stores', total: 'Rs. 2,250.00', status: 'Paid' },
  { product: 'Milk 1L', customer: 'Bhatta Mart', total: 'Rs. 180.00', status: 'Pending' },
  { product: 'Soap Pack', customer: 'Nepal Mart', total: 'Rs. 620.00', status: 'Overdue' },
];

const tabs = [
  {
    value: 'overview',
    label: 'Overview',
    content: <div className="ds-grid ds-grid--four"><StatCard label="Revenue" value={formatNPR(1250000)} change="+12.4%" /><StatCard label="Gross Profit" value={formatNPR(820000)} change="+8.6%" /><StatCard label="Net Profit" value={formatNPR(410000)} change="-2.4%" direction="down" /><StatCard label="Inventory" value={formatNPR(1950000)} change="+5.1%" /></div>,
  },
  {
    value: 'orders',
    label: 'Orders',
    content: <DataTable columns={[{ key: 'product', label: 'Product' }, { key: 'customer', label: 'Customer' }, { key: 'total', label: 'Total', align: 'right' }, { key: 'status', label: 'Status' }]} rows={tableRows.map((row) => ({ product: row.product, customer: row.customer, total: row.total, status: <StatusPill tone={row.status === 'Paid' ? 'success' : row.status === 'Pending' ? 'warning' : 'danger'}>{row.status}</StatusPill> }))} />,
  },
  {
    value: 'states',
    label: 'States',
    content: <EmptyState title="No purchase orders yet" description="Create a supplier order to begin tracking stock intake." action={<Button variant="primary">Create order</Button>} />, 
  },
];

export const DesignSystemPage: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [modalOpen, setModalOpen] = useState(false);
  const [tabValue, setTabValue] = useState('overview');
  const [checked, setChecked] = useState(true);
  const [switchEnabled, setSwitchEnabled] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('grocery');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="ds-shell" data-theme={theme}>
      <div className="ds-container">
        <PageHeader
          title="Startup ERP – Design System"
          description="Light + dark tokens, clear typography, and accessible foundations for POS, operations and finance."
          action={
            <div className="ds-demo-group">
              <Button variant="secondary" size="sm" onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}>
                {theme === 'light' ? 'Dark theme' : 'Light theme'}
              </Button>
              <Button variant="primary" size="sm">Review tokens</Button>
            </div>
          }
        />

        <section className="ds-section">
          <div className="ds-kicker">Brand</div>
          <div className="ds-grid ds-grid--four">
            <Card>
              <div className="ds-kicker">Primary</div>
              <div style={{ width: '100%', height: 54, borderRadius: 12, background: 'var(--ds-brand)', marginBottom: 12 }} />
              <div className="ds-mono">#2946C6</div>
            </Card>
            <Card>
              <div className="ds-kicker">Success</div>
              <div style={{ width: '100%', height: 54, borderRadius: 12, background: 'var(--ds-success)', marginBottom: 12 }} />
              <div className="ds-mono">#13795B</div>
            </Card>
            <Card>
              <div className="ds-kicker">Warning</div>
              <div style={{ width: '100%', height: 54, borderRadius: 12, background: 'var(--ds-warning)', marginBottom: 12 }} />
              <div className="ds-mono">#A16207</div>
            </Card>
            <Card>
              <div className="ds-kicker">Danger</div>
              <div style={{ width: '100%', height: 54, borderRadius: 12, background: 'var(--ds-danger)', marginBottom: 12 }} />
              <div className="ds-mono">#C6283D</div>
            </Card>
          </div>
        </section>

        <section className="ds-section">
          <div className="ds-section__header">
            <div>
              <div className="ds-kicker">Buttons</div>
              <h2>Actions</h2>
            </div>
          </div>
          <div className="ds-demo-group">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" size="lg">Large</Button>
            <Button variant="primary" loading>Loading</Button>
          </div>
        </section>

        <section className="ds-section">
          <div className="ds-section__header">
            <div>
              <div className="ds-kicker">Inputs</div>
              <h2>Form controls</h2>
            </div>
          </div>
          <div className="ds-grid ds-grid--two">
            <Card>
              <div className="ds-field">
                <label className="ds-label">Input</label>
                <Input defaultValue="Organic rice 5kg" />
              </div>
              <div className="ds-field" style={{ marginTop: 16 }}>
                <label className="ds-label">Money</label>
                <MoneyInput defaultValue="125000" symbol="Rs." />
              </div>
            </Card>
            <Card>
              <SelectField
                label="Category"
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                placeholder="Select a category"
                options={[
                  { value: 'grocery', label: 'Grocery' },
                  { value: 'beverages', label: 'Beverages' },
                  { value: 'snacks', label: 'Snacks' },
                ]}
              />
              <div style={{ marginTop: 16 }}>
                <CheckboxField label="VAT enabled" checked={checked} onCheckedChange={setChecked} />
              </div>
              <div style={{ marginTop: 16 }}>
                <SwitchField label="Auto-reorder" checked={switchEnabled} onCheckedChange={setSwitchEnabled} />
              </div>
            </Card>
          </div>
        </section>

        <section className="ds-section">
          <div className="ds-kicker">Money</div>
          <div className="ds-grid ds-grid--two">
            <Card>
              <p>{formatNPR(125000)}</p>
              <p>{formatNPR(1250000, { compact: true })}</p>
              <p>{formatNPR(15300000, { compact: true })}</p>
              <p>{formatNPR(125000, { symbol: 'रू' })}</p>
            </Card>
            <Card>
              <div className="ds-demo-group">
                <StatusPill tone="success">Paid</StatusPill>
                <StatusPill tone="warning">Low stock</StatusPill>
                <StatusPill tone="danger">Overdue</StatusPill>
                <StatusPill tone="info">B2B</StatusPill>
                <Badge tone="success">+18.2%</Badge>
              </div>
            </Card>
          </div>
        </section>

        <section className="ds-section">
          <div className="ds-section__header">
            <div>
              <div className="ds-kicker">Content</div>
              <h2>Tables + states</h2>
            </div>
          </div>
          <Tabs tabs={tabs} value={tabValue} onValueChange={setTabValue} />
        </section>

        <section className="ds-section">
          <div className="ds-grid ds-grid--two">
            <Card>
              <div className="ds-kicker">Skeleton</div>
              <Skeleton rows={5} />
            </Card>
            <Card>
              <div className="ds-kicker">Tooltip</div>
              <Tooltip content="Reorder quantity is set by min stock policy.">
                <Button variant="secondary">Hover for info</Button>
              </Tooltip>
              <div style={{ marginTop: 18 }}>
                <div className="ds-kicker">Toast</div>
                <Toast title="Saved successfully" description="Inventory update synced." />
              </div>
            </Card>
          </div>
        </section>

        <section className="ds-section">
          <div className="ds-grid ds-grid--two">
            <Card>
              <div className="ds-kicker">Modal</div>
              <Button variant="primary" onClick={() => setModalOpen(true)}>Open modal</Button>
            </Card>
            <Card>
              <div className="ds-kicker">Empty state</div>
              <EmptyState title="No recent sales" description="Create your first invoice to begin tracking revenue." action={<Button variant="primary">Make a sale</Button>} />
            </Card>
          </div>
        </section>
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="Create branch" description="Set up a retail or warehouse location.">
        <div className="ds-field">
          <label className="ds-label">Branch name</label>
          <Input defaultValue="New Baneshwor Branch" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          <div className="ds-field">
            <label className="ds-label">Code</label>
            <Input defaultValue="BR-NEW" />
          </div>
          <div className="ds-field">
            <label className="ds-label">Type</label>
            <Input defaultValue="Retail" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => setModalOpen(false)}>Save branch</Button>
        </div>
      </Modal>
    </div>
  );
};
