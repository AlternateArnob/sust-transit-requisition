interface Column<T> {
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle: string;
  emptyDescription?: string;
}

/**
 * Standard table: white card, light header row with small uppercase
 * column labels, thin row rules — the same quiet look as the form and
 * the printed slips.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle,
  emptyDescription,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-text-muted">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.header}
                  className={`px-4 py-3 font-semibold ${
                    column.align === "right" ? "text-right" : ""
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <p className="font-medium text-text">{emptyTitle}</p>

                  {emptyDescription && (
                    <p className="mt-1 text-sm text-text-muted">
                      {emptyDescription}
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-t border-border first:border-t-0 hover:bg-surface/60"
                >
                  {columns.map((column) => (
                    <td
                      key={column.header}
                      className={`px-4 py-3 text-text ${
                        column.align === "right" ? "text-right" : ""
                      }`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
