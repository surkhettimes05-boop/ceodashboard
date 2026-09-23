import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

export const Tabs: React.FC<{ tabs: Array<{ value: string; label: string; content: React.ReactNode }>; value: string; onValueChange: (value: string) => void; }> = ({ tabs, value, onValueChange }) => (
  <TabsPrimitive.Root value={value} onValueChange={onValueChange} className="ds-tabs">
    <TabsPrimitive.List className="ds-tabs__list">
      {tabs.map((tab) => (
        <TabsPrimitive.Trigger key={tab.value} value={tab.value} className="ds-tabs__trigger">
          {tab.label}
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>
    {tabs.map((tab) => (
      <TabsPrimitive.Content key={tab.value} value={tab.value} className="ds-tabs__content">
        {tab.content}
      </TabsPrimitive.Content>
    ))}
  </TabsPrimitive.Root>
);
