// components/ui/VerdictBadge.js
// BUY / HOLD / SELL monochromatic chip

export default function VerdictBadge({ verdict, size = 'md' }) {
  const v = (verdict || 'HOLD').toUpperCase();

  const classes = {
    BUY: 'verdict-buy',
    ACCUMULATE: 'verdict-buy',
    HOLD: 'verdict-hold',
    SELL: 'verdict-sell',
    AVOID: 'verdict-avoid',
    REDUCE: 'verdict-sell',
  };

  const sizeClasses = {
    sm: 'text-xs py-1 px-3',
    md: 'text-sm py-1.5 px-5',
    lg: 'text-xl py-2 px-8',
  };

  return (
    <span className={`verdict-badge ${classes[v] || 'verdict-hold'} ${sizeClasses[size]}`}>
      {v}
    </span>
  );
}
