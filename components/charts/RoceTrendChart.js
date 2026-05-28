// components/charts/RoceTrendChart.js
// Bar chart: ROCE trend over years

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export default function RoceTrendChart({ years, roce }) {
  const data = years.map((yr, i) => ({
    year: yr,
    roce: roce[i] || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
        <XAxis dataKey="year" tick={{ fill: '#555566', fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
        <YAxis tick={{ fill: '#555566', fontSize: 11, fontFamily: 'IBM Plex Mono' }} unit="%" />
        <Tooltip
          contentStyle={{ background: '#111118', border: '1px solid #2a2a35', borderRadius: 4, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
          labelStyle={{ color: '#8a8899' }}
          formatter={(val) => [`${val}%`, 'ROCE']}
        />
        <Bar dataKey="roce" radius={[2, 2, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.roce >= 15 ? '#52c47a' : entry.roce >= 10 ? '#d4a843' : '#e05252'} opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
