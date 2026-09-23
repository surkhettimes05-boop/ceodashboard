import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

export type SelectOption = { value: string; label: string; disabled?: boolean };

export const SelectField = ({
  label,
  value,
  onValueChange,
  placeholder,
  options,
  disabled,
  id,
  triggerClassName,
}: {
  label: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  options: SelectOption[];
  id?: string;
  triggerClassName?: string;
}) => (
  <div className="ds-field">
    <label className="ds-label">{label}</label>
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger id={id} className={triggerClassName ? `ds-select-trigger ${triggerClassName}` : 'ds-select-trigger'} aria-label={label}>
        <SelectPrimitive.Value placeholder={placeholder ?? 'Select an option'} />
        <SelectPrimitive.Icon>
          <ChevronDown size={16} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="ds-select-content"
          position="popper"
          sideOffset={6}
          align="start"
          style={{ width: 'var(--radix-select-trigger-width)', zIndex: 1000 }}
        >
          <SelectPrimitive.ScrollUpButton className="ds-select-scroll-button">
            <ChevronUp size={14} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="ds-select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item key={option.value} value={option.value} disabled={option.disabled} className="ds-select-item">
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ds-select-item-indicator">
                  <Check size={14} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="ds-select-scroll-button">
            <ChevronDown size={14} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  </div>
);
