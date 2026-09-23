import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export const Modal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ open, onOpenChange, title, description, children }) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="ds-modal__overlay" />
      <Dialog.Content className="ds-modal">
        <div className="ds-modal__header">
          <div>
            <Dialog.Title className="ds-modal__title">{title}</Dialog.Title>
            {description ? <Dialog.Description className="ds-modal__description">{description}</Dialog.Description> : null}
          </div>
          <Dialog.Close className="ds-modal__close" aria-label="Close">
            <X size={16} />
          </Dialog.Close>
        </div>
        <div className="ds-modal__body">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
