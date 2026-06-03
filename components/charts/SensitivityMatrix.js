// components/charts/SensitivityMatrix.js
// Color-coded HTML table: intrinsic value across growth × WACC

export default function SensitivityMatrix({ data, currentPrice }) {
  if (!data?.matrix?.length) return null;

  const cmp = currentPrice || 0;

  function getCellColor(value) {
    if (!cmp) return '';
    const diff = ((value - cmp) / cmp) * 100;
    if (diff > 30) return 'text-positive bg-positive/10';
    if (diff > 10) return 'text-positive/80';
    if (diff > -10) return 'text-text-primary';
    if (diff > -30) return 'text-negative/80';
    return 'text-negative bg-negative/10';
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Growth \ WACC</th>
            {data.waccRates.map(w => <th key={w} className="text-right">{w}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.matrix.map((row, i) => (
            <tr key={i}>
              <td className="font-semibold">{data.growthRates[i]}</td>
              {row.map((val, j) => (
                <td key={j} className={`num text-right ${getCellColor(val)}`}>
                  ₹{val?.toLocaleString('en-IN')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {cmp > 0 && (
        <div className="text-text-muted text-xs mt-2 font-mono">
          CMP: ₹{cmp.toLocaleString('en-IN')} — Green = undervalued, Red = overvalued
        </div>
      )}
    </div>
  );
}
