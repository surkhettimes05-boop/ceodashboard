import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SwitchPrimitive from '@radix-ui/react-switch';

export const CheckboxField = ({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <label className="ds-checkbox-row">
    <CheckboxPrimitive.Root className="ds-checkbox" checked={checked} onCheckedChange={(next) => onCheckedChange(Boolean(next))}>
      <CheckboxPrimitive.Indicator className="ds-checkbox__indicator">
        <svg viewBox="0 0 16 16" aria-hidden="true" width="12" height="12">
          <path d="M13 4.5L6.5 11 3 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
    <span>{label}</span>
  </label>
);

export const SwitchField = ({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="ds-switch-row">
    <span>{label}</span>
    <SwitchPrimitive.Root className="ds-switch" checked={checked} onCheckedChange={onCheckedChange}>
      <SwitchPrimitive.Thumb className="ds-switch__thumb" />
    </SwitchPrimitive.Root>
  </div>
);

export const StatusPill: React.FC<{ children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }> = ({ children, tone = 'neutral' }) => (
  <span className={['ds-status-pill', `ds-status-pill--${tone}`].join(' ')}>{children}</span>
);

export const StatCard: React.FC<{
  label: string;
  value: string;
  change?: string;
  direction?: 'up' | 'down';
}> = ({ label, value, change, direction = 'up' }) => (
  <div className="ds-card ds-stat-card">
    <div className="ds-stat-card__header">
      <span className="ds-stat-card__label">{label}</span>
      <span className={['ds-stat-card__trend', direction === 'up' ? 'is-up' : 'is-down'].join(' ')}>{change ?? '—'}</span>
    </div>
    <div className="ds-stat-card__value">{value}</div>
  </div>
);
