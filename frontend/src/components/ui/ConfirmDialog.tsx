import * as React from 'react';

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div className="ds-confirm-backdrop" role="dialog" aria-modal="true">
      <div className="ds-confirm">
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="ds-confirm__actions">
          <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="ds-btn ds-btn--danger ds-btn--sm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};
