// components/ui/ScoreBar.js
// Horizontal strip showing 5 scores in a row

export default function ScoreBar({ scores }) {
  // scores: [{ label, value, max }]
  return (
    <div className="flex gap-0 border border-border rounded overflow-hidden">
      {scores.map((s, i) => (
        <div
          key={s.label}
          className={`flex-1 text-center py-3 px-2 ${i > 0 ? 'border-l border-border' : ''}`}
        >
          <div className="label mb-1" style={{ fontSize: '10px' }}>{s.label}</div>
          <div className="font-mono font-bold text-lg text-text-primary">
            {s.value}<span className="text-text-muted text-xs">/{s.max || 10}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
