import * as React from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  title: string;
  description?: string;
  tone?: ToastTone;
};

const defaultToastContext = {
  push: (_item: Omit<ToastItem, 'id'>) => undefined,
};

const ToastContext = React.createContext<{
  push: (item: Omit<ToastItem, 'id'>) => void;
}>(defaultToastContext);

export const Toast: React.FC<{ title: string; description?: string; tone?: ToastTone }> = ({ title, description, tone = 'info' }) => (
  <div className={['ds-toast', `ds-toast--${tone}`].join(' ')} role="status">
    <strong>{title}</strong>
    {description ? <span>{description}</span> : null}
  </div>
);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const push = React.useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { ...item, id }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="ds-toast-stack" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <Toast key={item.id} title={item.title} description={item.description} tone={item.tone ?? 'info'} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => React.useContext(ToastContext);
