import * as React from 'react';

export const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, children }) => {
  if (!open) return null;

  return (
    <>
      <div className="ds-drawer-backdrop" onClick={onClose} />
      <aside className="ds-drawer" aria-modal="true" role="dialog">
        <div className="ds-drawer__header">
          <h3>{title}</h3>
          <button type="button" className="ds-modal__close" onClick={onClose} aria-label="Close drawer">×</button>
        </div>
        <div className="ds-drawer__body">{children}</div>
      </aside>
    </>
  );
};
