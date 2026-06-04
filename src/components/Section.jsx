export default function Section({ eyebrow, title, action, children }) {
  return (
    <section className="panel section">
      <div className="section__header">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
