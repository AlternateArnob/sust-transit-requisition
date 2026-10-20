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

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle,
  emptyDescription,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#0F2747] text-white">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.header}
                  className={`px-4 py-3 font-medium ${
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
                  <p className="font-medium text-[#1E293B]">{emptyTitle}</p>

                  {emptyDescription && (
                    <p className="mt-1 text-sm text-[#64748B]">
                      {emptyDescription}
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={rowKey(row)}
                  className={`border-t border-[#E2E8F0] ${
                    index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                  }`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.header}
                      className={`px-4 py-3 text-[#64748B] ${
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
