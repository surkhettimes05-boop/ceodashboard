import * as React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = '', variant = 'primary', size = 'md', loading, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={[`ds-btn`, `ds-btn--${variant}`, `ds-btn--${size}`, loading ? 'is-loading' : '', className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="ds-btn__spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
});
