import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LogOut, User, Building, Shield, Settings as SettingsIcon } from 'lucide-react';

const formatRoleLabel = (role?: string) => {
  const normalized = (role || '').toUpperCase();

  switch (normalized) {
    case 'CEO':
      return 'Chief Executive Officer';
    case 'ADMIN':
      return 'Administrator';
    case 'MANAGER':
      return 'Manager';
    case 'ACCOUNTANT':
      return 'Accountant';
    case 'CASHIER':
      return 'Cashier';
    default:
      return normalized.replace(/_/g, ' ') || 'User';
  }
};

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  return (
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span className="badge badge-primary">
          <Shield size={12} style={{ marginRight: '4px' }} />
          ROLE: {formatRoleLabel(user?.role)}
        </span>
        {user?.branchName && (
          <span className="badge badge-emerald">
            <Building size={12} style={{ marginRight: '4px' }} />
            {user.branchName}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--bg-card-hover)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User size={18} color="var(--primary)" />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {user?.fullName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              @{user?.username}
            </div>
          </div>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => navigate('/settings')}
          style={{ padding: '8px 12px', fontSize: '0.8rem' }}
          title="Settings"
        >
          <SettingsIcon size={16} />
          <span>Settings</span>
        </button>

        <button
          className="btn btn-secondary"
          onClick={logout}
          style={{ padding: '8px 12px', fontSize: '0.8rem' }}
          title="Sign Out"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
