import Generator from './Generator'

export default function AuthorizedApp(props) {
  return <>
    <Generator {...props} />
    {Array.isArray(props.workout) && props.workout.length > 0 && <section className="current-workout" aria-labelledby="current-workout-heading">
      <h2 id="current-workout-heading">Current workout</h2>
      <p>This workout remains unchanged until a replacement is ready.</p>
      <ul>{props.workout.map((exercise, index) => <li key={exercise.occurrenceId ?? `${exercise.id}-${index}`}>{exercise.name ?? exercise.id}</li>)}</ul>
    </section>}
  </>
}
