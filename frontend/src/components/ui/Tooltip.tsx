import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export const Tooltip: React.FC<{ children: React.ReactNode; content: string }> = ({ children, content }) => (
  <TooltipPrimitive.Provider delayDuration={150}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="ds-tooltip" sideOffset={8}>
          {content}
          <TooltipPrimitive.Arrow className="ds-tooltip__arrow" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>
);
