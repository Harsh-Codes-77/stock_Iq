// components/charts/PatCfoChart.js
// Line chart: PAT vs CFO over time — divergence = earnings quality red flag

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function PatCfoChart({ years, pat, cfo }) {
  const data = years.map((yr, i) => ({
    year: yr,
    pat: pat[i] || 0,
    cfo: cfo[i] || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
        <XAxis dataKey="year" tick={{ fill: '#555566', fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
        <YAxis tick={{ fill: '#555566', fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
        <Tooltip
          contentStyle={{ background: '#111118', border: '1px solid #2a2a35', borderRadius: 4, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
          labelStyle={{ color: '#8a8899' }}
        />
        <Legend />
        <Line type="monotone" dataKey="pat" name="PAT (₹ Cr)" stroke="#d4a843" strokeWidth={2} dot={{ r: 3, fill: '#d4a843' }} />
        <Line type="monotone" dataKey="cfo" name="CFO (₹ Cr)" stroke="#52c47a" strokeWidth={2} dot={{ r: 3, fill: '#52c47a' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
