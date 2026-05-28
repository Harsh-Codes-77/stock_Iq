// components/charts/DuPontChart.js
// Horizontal bar showing the 3 components of ROE

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function DuPontChart({ dupont }) {
  if (!dupont) return null;

  const data = [
    { name: 'Net Profit Margin', value: dupont.netProfitMargin, unit: '%' },
    { name: 'Asset Turnover', value: dupont.assetTurnover, unit: 'x' },
    { name: 'Equity Multiplier', value: dupont.equityMultiplier, unit: 'x' },
  ];

  const colors = ['#d4a843', '#52c47a', '#8a8899'];

  return (
    <div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 100, bottom: 0 }}>
          <XAxis type="number" tick={{ fill: '#555566', fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#8a8899', fontSize: 11, fontFamily: 'DM Sans' }} width={100} />
          <Tooltip
            contentStyle={{ background: '#111118', border: '1px solid #2a2a35', borderRadius: 4, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 2, 2, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors[i]} opacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-between mt-2 text-xs font-mono text-text-muted px-2">
        <span>Implied ROE: <span className="text-accent font-semibold">{dupont.roe}%</span></span>
        <span className="text-text-muted">({dupont.analysis === 'MARGIN_DRIVEN' ? 'Margin-driven' : 'Turnover-driven'})</span>
      </div>
    </div>
  );
}
