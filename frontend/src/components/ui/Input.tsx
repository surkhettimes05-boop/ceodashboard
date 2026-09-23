import * as React from 'react';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...props },
  ref
) {
  return <input ref={ref} className={['ds-input', className].filter(Boolean).join(' ')} {...props} />;
});
