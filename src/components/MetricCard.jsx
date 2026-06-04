export default function MetricCard({ label, value, sublabel }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      {sublabel ? <span>{sublabel}</span> : null}
    </article>
  );
}
