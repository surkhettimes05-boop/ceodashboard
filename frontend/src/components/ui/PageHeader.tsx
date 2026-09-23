import * as React from 'react';

export const PageHeader: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <header className="ds-page-header">
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
    {action ? <div className="ds-page-header__action">{action}</div> : null}
  </header>
);
