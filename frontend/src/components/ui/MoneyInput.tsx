import * as React from 'react';

export const MoneyInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { symbol?: 'Rs.' | 'रू' }>(function MoneyInput(
  { className = '', symbol = 'Rs.', ...props },
  ref
) {
  return (
    <div className="ds-money-input">
      <span className="ds-money-input__prefix">{symbol}</span>
      <input ref={ref} className={['ds-input', className].filter(Boolean).join(' ')} inputMode="decimal" {...props} />
    </div>
  );
});
