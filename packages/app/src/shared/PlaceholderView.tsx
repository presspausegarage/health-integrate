interface Props {
  title: string;
  description: string;
  phase: string;
  bullets: string[];
}

export function PlaceholderView({ title, description, phase, bullets }: Props) {
  return (
    <div className="placeholder-view">
      <div className="placeholder-inner">
        <h1 className="placeholder-title">{title}</h1>
        <p className="placeholder-desc">{description}</p>
        <div className="placeholder-phase">Planned: {phase}</div>
        <ul className="placeholder-bullets">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
