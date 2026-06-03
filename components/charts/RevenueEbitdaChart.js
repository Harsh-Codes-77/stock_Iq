// components/charts/RevenueEbitdaChart.js
// ComposedChart: Revenue bars + EBITDA Margin line (dual axis)

import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function RevenueEbitdaChart({ years, revenue, ebitdaMargin }) {
  const data = years.map((yr, i) => ({
    year: yr,
    revenue: revenue[i] || 0,
    ebitdaMargin: ebitdaMargin[i] || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
        <XAxis dataKey="year" tick={{ fill: '#555566', fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
        <YAxis yAxisId="left" tick={{ fill: '#555566', fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#555566', fontSize: 11, fontFamily: 'IBM Plex Mono' }} unit="%" />
        <Tooltip
          contentStyle={{ background: '#111118', border: '1px solid #2a2a35', borderRadius: 4, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
          labelStyle={{ color: '#8a8899' }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="revenue" name="Revenue (₹ Cr)" fill="#d4a843" opacity={0.8} radius={[2, 2, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="ebitdaMargin" name="EBITDA Margin %" stroke="#52c47a" strokeWidth={2} dot={{ r: 3, fill: '#52c47a' }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
