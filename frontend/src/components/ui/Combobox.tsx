import * as React from 'react';

export type ComboboxOption = { value: string; label: string; disabled?: boolean };

export const Combobox = ({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
}) => {
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="ds-field">
      <label className="ds-label">{label}</label>
      <input
        className="ds-input"
        value={query || (options.find((option) => option.value === value)?.label ?? '')}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder ?? 'Search...'}
        aria-label={label}
      />
      {filtered.length > 0 ? (
        <div className="ds-combobox-list" role="listbox">
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              className="ds-combobox-option"
              onClick={() => {
                onChange(option.value);
                setQuery('');
              }}
              disabled={option.disabled}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
