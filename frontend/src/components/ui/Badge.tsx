import * as React from 'react';

export const Badge: React.FC<{ children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }> = ({ children, tone = 'neutral' }) => (
  <span className={['ds-badge', `ds-badge--${tone}`].join(' ')}>{children}</span>
);
