import * as React from 'react';

export const EmptyState: React.FC<{ title: string; description: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <div className="ds-empty-state">
    <div className="ds-empty-state__icon">•</div>
    <h3>{title}</h3>
    <p>{description}</p>
    {action ? <div className="ds-empty-state__action">{action}</div> : null}
  </div>
);
