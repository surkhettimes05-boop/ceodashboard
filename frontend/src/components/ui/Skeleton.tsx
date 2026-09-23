import * as React from 'react';

export const Skeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="ds-skeleton-stack" aria-busy="true">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="ds-skeleton-row" />
    ))}
  </div>
);
