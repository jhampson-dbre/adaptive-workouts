import Generator from './Generator'

export default function AuthorizedApp(props) {
  return <>
    <Generator {...props} />
    {Array.isArray(props.workout) && props.workout.length === 0 && <section className="workout-result">
      <h2>Your Workout</h2>
      <p>No exercises fit the criteria or time budget.</p>
    </section>}
  </>
}
