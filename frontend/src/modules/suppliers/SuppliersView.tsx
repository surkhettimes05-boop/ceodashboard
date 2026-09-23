import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui';
import { Truck, Plus, Phone, Mail } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  _count: { purchases: number };
}

export const SuppliersView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/suppliers');
      setSuppliers(res.data.data);
    } catch (err: any) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/suppliers', {
        name,
        contactPerson,
        phone,
        email,
      });
      setShowModal(false);
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      fetchSuppliers();
    } catch (err: any) {
      push({ title: 'Unable to save supplier', description: err.response?.data?.message || 'Error creating supplier', tone: 'error' });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>Suppliers & Vendor Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Maintain supplier profiles, purchase order channels, and procurement contacts.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          <span>Add New Supplier</span>
        </button>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading suppliers...
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Primary Contact</th>
                  <th>Phone & Email</th>
                  <th>Total Orders</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No supplier records found. Click "Add New Supplier" to create one.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{s.name}</td>
                      <td>{s.contact_person || 'N/A'}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {s.phone && <div>📞 {s.phone}</div>}
                        {s.email && <div>✉️ {s.email}</div>}
                      </td>
                      <td>
                        <span className="badge badge-primary">{s._count?.purchases || 0} Orders</span>
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>
              Add Supplier / Vendor
            </h2>
            <form onSubmit={handleCreateSupplier}>
              <div className="form-group">
                <label className="form-label">Supplier Company Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Global Beverage Wholesalers Ltd" />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <input className="input" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Sarah Jenkins" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 800-555-0199" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="orders@globalbev.com" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
