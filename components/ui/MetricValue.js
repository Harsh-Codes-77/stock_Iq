// components/ui/MetricValue.js
// Renders a number with automatic red/green coloring in monospace font

export default function MetricValue({ value, suffix = '', prefix = '', neutral = false, className = '' }) {
  const num = parseFloat(value);
  const isPositive = num > 0;
  const isNegative = num < 0;

  const color = neutral
    ? 'text-text-primary'
    : isPositive
      ? 'text-positive'
      : isNegative
        ? 'text-negative'
        : 'text-text-secondary';

  const display = value !== null && value !== undefined && value !== 'N/A'
    ? `${prefix}${value}${suffix}`
    : 'N/A';

  return (
    <span className={`font-mono font-semibold tabular-nums ${color} ${className}`}>
      {display}
    </span>
  );
}
