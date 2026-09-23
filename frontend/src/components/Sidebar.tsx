import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BookOpen,
  Users,
  Truck,
  Building2,
  TrendingUp,
  UserCheck,
  Tag,
  ShoppingBag,
  Settings,
  HeartHandshake,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || [];
  const role = user?.role || '';

  const hasAccess = (required: string[]) => {
    if (role === 'CEO' || role === 'ADMIN') return true;
    return required.some((p) => permissions.includes(p));
  };

  const sections = [
    {
      title: 'Operations',
      items: [
        hasAccess(['dashboard:view']) && { to: '/ceo-dashboard', label: 'Overview', icon: LayoutDashboard },
        hasAccess(['sales:create']) && { to: '/pos', label: 'POS Register', icon: ShoppingCart },
        { to: '/products', label: 'Products', icon: Tag },
        hasAccess(['inventory:view']) && { to: '/inventory', label: 'Inventory', icon: Package },
        { to: '/purchases', label: 'Purchasing', icon: ShoppingBag },
      ].filter(Boolean) as Array<{ to: string; label: string; icon: typeof LayoutDashboard }>,
    },
    {
      title: 'Sales',
      items: [
        hasAccess(['sales:view']) && { to: '/sales', label: 'Sales & Invoices', icon: TrendingUp },
        { to: '/customers', label: 'Customers', icon: UserCheck },
        hasAccess(['LOYALTY_VIEW']) && { to: '/loyalty', label: 'Loyalty', icon: HeartHandshake },
        { to: '/suppliers', label: 'Suppliers', icon: Truck },
      ].filter(Boolean) as Array<{ to: string; label: string; icon: typeof LayoutDashboard }>,
    },
    {
      title: 'Finance',
      items: [
        hasAccess(['accounting:view']) && { to: '/accounting', label: 'General Ledger', icon: BookOpen },
      ].filter(Boolean) as Array<{ to: string; label: string; icon: typeof LayoutDashboard }>,
    },
    {
      title: 'Administration',
      items: [
        hasAccess(['users:view']) && { to: '/admin/branches', label: 'Branches & WH', icon: Building2 },
        hasAccess(['users:view']) && { to: '/admin/users', label: 'Users & Roles', icon: Users },
        { to: '/settings', label: 'Settings', icon: Settings },
      ].filter(Boolean) as Array<{ to: string; label: string; icon: typeof LayoutDashboard }>,
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">S</div>
        <div>
          <h2>Startup ERP</h2>
          <p>POS & Accounting</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.title} className="sidebar-section">
            <div className="sidebar-section__label">{section.title}</div>
            <ul className="nav-list">
              {section.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Icon size={18} />
                    <span>{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
};
