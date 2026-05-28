// components/charts/ShareholdingChart.js
// Stacked bar chart: promoter/FII/DII/public + pledge line overlay

import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ShareholdingChart({ trend }) {
  if (!trend?.length) return <div className="text-text-muted text-sm p-4">No shareholding trend data available.</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
        <XAxis dataKey="quarter" tick={{ fill: '#555566', fontSize: 10, fontFamily: 'IBM Plex Mono' }} />
        <YAxis tick={{ fill: '#555566', fontSize: 11, fontFamily: 'IBM Plex Mono' }} unit="%" />
        <Tooltip
          contentStyle={{ background: '#111118', border: '1px solid #2a2a35', borderRadius: 4, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
          labelStyle={{ color: '#8a8899' }}
        />
        <Legend />
        <Bar dataKey="promoter" name="Promoter" stackId="a" fill="#d4a843" />
        <Bar dataKey="fii" name="FII" stackId="a" fill="#8a8899" />
        <Bar dataKey="dii" name="DII" stackId="a" fill="#555566" />
        <Bar dataKey="public" name="Public" stackId="a" fill="#2a2a35" />
        <Line type="monotone" dataKey="pledge" name="Pledge %" stroke="#e05252" strokeWidth={2} dot={{ r: 3, fill: '#e05252' }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
