type Metric = { label: string; value: string; note?: string };

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className="metric-strip">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>{metric.value}</dd>
          {metric.note && <span>{metric.note}</span>}
        </div>
      ))}
    </dl>
  );
}

