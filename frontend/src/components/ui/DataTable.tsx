import * as React from 'react';

export type DataTableColumn<T> = {
  key: keyof T | string;
  label: string;
  align?: 'left' | 'right';
  sortable?: boolean;
};

export const DataTable = <T,>({
  columns,
  rows,
  emptyMessage,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
}) => {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const sortedRows = React.useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a: any, b: any) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      if (aValue === bValue) return 0;
      return typeof aValue === 'number' && typeof bValue === 'number'
        ? (aValue - bValue) * (sortDir === 'asc' ? 1 : -1)
        : String(aValue).localeCompare(String(bValue)) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} className={column.align === 'right' ? 'is-right' : ''}>
                {column.sortable ? (
                  <button type="button" className="ds-table__sort" onClick={() => handleSort(String(column.key))}>
                    {column.label}
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="ds-table__empty">{emptyMessage ?? 'No rows available.'}</td>
            </tr>
          ) : (
            sortedRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td key={String(column.key)} className={column.align === 'right' ? 'is-right' : ''}>
                    {(row as any)[String(column.key)]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
