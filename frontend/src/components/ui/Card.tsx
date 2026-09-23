import * as React from 'react';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={['ds-card', className].filter(Boolean).join(' ')}>{children}</div>
);
