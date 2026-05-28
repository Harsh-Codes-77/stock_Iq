// components/ui/DataTable.js
// Reusable dark-themed data table with mono font for numbers

export default function DataTable({ headers, rows, highlightRow = -1 }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className={i > 0 ? 'text-right' : ''}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={i === highlightRow ? 'bg-bg-tertiary' : ''}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={j > 0 ? 'num text-right' : ''}
                  style={cell?.color ? { color: cell.color } : {}}
                >
                  {cell?.value !== undefined ? cell.value : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
