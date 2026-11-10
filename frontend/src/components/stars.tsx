export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const steps = [1, 2, 3, 4, 5];
  if (!onChange) {
    return (
      <span className="stars" role="img" aria-label={`${value} de 5 estrellas`}>
        {steps.map((n) => (
          <span key={n} aria-hidden="true" className={n <= value ? "star on" : "star"}>
            {n <= value ? "★" : "☆"}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="stars" role="group" aria-label="Calificación">
      {steps.map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? "star on" : "star"}
          aria-label={`${n} estrellas`}
          aria-pressed={n === value}
          onClick={() => onChange(n)}
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </span>
  );
}
