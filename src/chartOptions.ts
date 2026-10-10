export const chartTypes = ['bar', 'horizontal', 'stacked', 'combo', 'line', 'pie'] as const;
export const chartFormats = ['number', 'currency', 'percent'] as const;

export function chartOptions(definition: { type: string; format?: string; currency?: string; legend?: boolean }, seriesCount: number) {
  if (!chartTypes.some(type => type === definition.type)) throw new Error('Unsupported chart type.');
  if (definition.type === 'combo' && seriesCount < 2) throw new Error('Combined charts require at least two numeric series.');
  const format = definition.format ?? 'number';
  if (!chartFormats.some(value => value === format)) throw new Error('Unsupported number format.');
  const formatter = new Intl.NumberFormat('en-US', {
    style: format === 'currency' ? 'currency' : format === 'percent' ? 'percent' : 'decimal',
    ...(format === 'currency' ? { currency: definition.currency ?? 'USD' } : {}), maximumFractionDigits: 2
  });
  return {
    type: definition.type === 'horizontal' || definition.type === 'stacked' || definition.type === 'combo' ? 'bar' as const : definition.type as 'bar' | 'line' | 'pie',
    options: {
      indexAxis: definition.type === 'horizontal' ? 'y' as const : 'x' as const,
      responsive: true, maintainAspectRatio: false, animation: false as const,
      plugins: {
        legend: { display: definition.legend ?? true },
        tooltip: { callbacks: { label: (context: { dataset: { label?: string }; parsed: { x?: number | null; y?: number | null } | number }) => {
          const value = typeof context.parsed === 'number' ? context.parsed : definition.type === 'horizontal' ? context.parsed.x : context.parsed.y;
          return `${context.dataset.label ?? ''}: ${value == null ? '' : formatter.format(value)}`;
        } } }
      },
      ...(definition.type === 'pie' ? {} : { scales: {
        x: { stacked: definition.type === 'stacked', ...(definition.type === 'horizontal' ? { ticks: { callback: (value: string | number) => formatter.format(Number(value)) } } : {}) },
        y: { stacked: definition.type === 'stacked', beginAtZero: true, ...(definition.type !== 'horizontal' ? { ticks: { callback: (value: string | number) => formatter.format(Number(value)) } } : {}) },
        ...(definition.type === 'combo' ? { y1: { position: 'right' as const, beginAtZero: true, grid: { drawOnChartArea: false } } } : {})
      } })
    }
  };
}