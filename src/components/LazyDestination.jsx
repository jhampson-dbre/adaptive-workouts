import { Component, Suspense, lazy, useEffect, useRef } from 'react'

const copy = {
  plan: { loadingHeading: 'Loading workout planner…', loading: 'Loading the workout planner.', failureHeading: 'Workout planner unavailable', failure: 'The workout planner couldn’t be loaded.', retry: 'Retry loading planner' },
  settings: { loadingHeading: 'Loading catalog settings…', loading: 'Loading catalog settings.', failureHeading: 'Catalog settings unavailable', failure: 'Catalog settings couldn’t be loaded.', retry: 'Retry loading catalog settings' },
  workout: { loadingHeading: 'Loading your workout…', loading: 'Loading your workout.', failureHeading: 'Workout unavailable', failure: 'Your generated workout couldn’t be loaded.', retry: 'Retry loading workout' },
}

function FocusedHeading({ children, id }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  return <h2 ref={ref} id={id} tabIndex="-1">{children}</h2>
}

function Loading({ destination }) {
  const text = copy[destination]
  return <section className="lazy-destination" aria-labelledby={`${destination}-loading-heading`}><FocusedHeading id={`${destination}-loading-heading`}>{text.loadingHeading}</FocusedHeading><p role="status" aria-live="polite">{text.loading}</p></section>
}

function Ready({ Component: Destination, componentProps, onReady }) {
  const ref = useRef(null)
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    const heading = ref.current?.querySelector('h1,h2')
    if (heading?.focus) { heading.tabIndex = -1; heading.focus() }
    onReadyRef.current?.()
  }, [])
  return <div ref={ref}><Destination {...componentProps} /></div>
}

class LoadBoundary extends Component {
  state = { error: null, retrying: false, replacement: null }
  retryGeneration = 0
  static getDerivedStateFromError(error) { return { error } }
  retry = () => {
    const attempt = this.props.retryLoader(++this.retryGeneration)
    this.setState({ retrying: true })
    attempt.then(module => {
      if (this.props.isCurrent?.() ?? true) this.setState({ error: null, retrying: false, replacement: lazy(() => Promise.resolve(module)) })
    }, () => {
      if (this.props.isCurrent?.() ?? true) this.setState({ retrying: false })
    })
  }
  render() {
    const { destination, Component: Initial, componentProps, onReady } = this.props
    const { error, retrying, replacement: Replacement } = this.state
    if (error) {
      const text = copy[destination]
      return <section className="lazy-destination" aria-labelledby={`${destination}-failure-heading`}>
        <FocusedHeading id={`${destination}-failure-heading`}>{text.failureHeading}</FocusedHeading>
        {retrying ? <p role="status" aria-live="polite">{text.loading}</p> : <p role="alert">{text.failure}</p>}
        <button type="button" disabled={retrying} onClick={this.retry}>{retrying ? 'Retrying…' : text.retry}</button>
      </section>
    }
    const Destination = Replacement ?? Initial
    return <Suspense fallback={<Loading destination={destination} />}><Ready Component={Destination} componentProps={componentProps} onReady={onReady} /></Suspense>
  }
}

export default function LazyDestination({ destination, loader, retryLoader = loader, componentProps, onReady, isCurrent }) {
  const componentRef = useRef(null)
  if (!componentRef.current) componentRef.current = lazy(loader)
  const Component = componentRef.current
  return <LoadBoundary destination={destination} Component={Component} retryLoader={retryLoader} componentProps={componentProps} onReady={onReady} isCurrent={isCurrent} />
}
