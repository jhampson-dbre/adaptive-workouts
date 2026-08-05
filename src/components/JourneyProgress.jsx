const STEPS = ['Plan', 'Workout', 'Cooldown', 'Review'];

export default function JourneyProgress({ current }) {
  return (
    <nav className="journey-progress" aria-label="Workout progress">
      <ol>
        {STEPS.map(step => (
          <li key={step} data-step={step} aria-current={step === current ? 'step' : undefined}>
            <span aria-hidden="true" />
            {step}
          </li>
        ))}
      </ol>
    </nav>
  );
}
