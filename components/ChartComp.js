import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export default function ChartComp({ type, data, height = 200, multiAxis }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  const isDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const textColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const isHorizontal = type === 'horizontalBar';
    const chartType = isHorizontal ? 'bar' : type;
    const legendPos = ['doughnut','pie'].includes(type) ? 'bottom' : 'top';

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: isHorizontal ? 'y' : 'x',
      plugins: {
        legend: {
          display: data.datasets.length > 1 || ['doughnut','pie'].includes(type),
          position: legendPos,
          labels: { color: textColor, font: { size: 10 }, boxWidth: 10, padding: 8 }
        }
      }
    };

    if (!['doughnut','pie'].includes(type)) {
      options.scales = {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } }
      };
      if (multiAxis) {
        options.scales.y2 = {
          position: 'right',
          ticks: { color: textColor, font: { size: 10 } },
          grid: { display: false }
        };
      }
    }

    // Style bars/lines
    const styledData = {
      ...data,
      datasets: data.datasets.map((ds, i) => ({
        borderRadius: chartType === 'bar' ? 4 : undefined,
        borderWidth: chartType === 'line' ? 2 : 1,
        pointRadius: chartType === 'line' ? 3 : undefined,
        ...ds
      }))
    };

    chartRef.current = new Chart(canvasRef.current, { type: chartType, data: styledData, options });
    return () => chartRef.current?.destroy();
  }, [data, type]);

  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
