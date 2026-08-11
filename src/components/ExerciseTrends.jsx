import { useCallback, useEffect, useRef, useState } from 'react';
import { projectExerciseTrends } from '../utils/trendProjection';
import { calendarRangeBounds, visibleCalendarDate } from '../utils/historyDate';

const ranges = ['1M', '3M', '6M', '1Y'];
const localFormatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
const utcFormatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const shortLocalFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric' });
const shortUtcFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', timeZone: 'UTC' });
const endDate = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const formatDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? utcFormatter.format(new Date(`${value}T00:00:00Z`)) : localFormatter.format(new Date(value));
const formatShortDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? shortUtcFormatter.format(new Date(`${value}T00:00:00Z`)) : shortLocalFormatter.format(new Date(value));
const modeLabel = mode => mode === 'weighted' ? 'Weighted' : 'Bodyweight';
const pointLabel = point => point.value === undefined ? `Full ${point.fullReps} · Assisted ${point.assistedReps} · Eccentric ${point.eccentricReps}` : `${point.value} lb volume`;
const identityKey = item => `${item.id}\0${item.trackingMode}`;
const signed = value => value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
const volumeChange = (current, previous) => `${signed(current - previous)} lb volume`;

export default function ExerciseTrends({ loadRange }) {
  const [discovery, setDiscovery] = useState({ phase: 'loading', trends: [], retrying: false });
  const [filter, setFilter] = useState(''); const [selected, setSelected] = useState(null); const [range, setRange] = useState('3M');
  const [detail, setDetail] = useState({ phase: 'idle', trend: null, point: 0, focusResult: false, retrying: false });
  const discoveryId = useRef(0); const detailId = useRef(0); const filterRef = useRef(null); const exercisesRef = useRef(null); const headingRef = useRef(null); const summaryRef = useRef(null); const emptyRef = useRef(null); const rows = useRef(new Map());
  const requestDiscovery = useCallback((retrying = false) => {
    const id = ++discoveryId.current; detailId.current += 1;
    setSelected(null); setDetail({ phase: 'idle', trend: null, point: 0, focusResult: false, retrying: false }); setDiscovery({ phase: retrying ? 'error' : 'loading', trends: [], retrying });
    Promise.resolve(loadRange({ range: '1Y', endDate: endDate() })).then(workouts => {
      if (id !== discoveryId.current) return;
      const trends = projectExerciseTrends(workouts).sort((a, b) => visibleCalendarDate(b.points.at(-1)?.date).localeCompare(visibleCalendarDate(a.points.at(-1)?.date)) || String(a.name).localeCompare(String(b.name)) || String(a.id).localeCompare(String(b.id)) || a.trackingMode.localeCompare(b.trackingMode));
      setDiscovery({ phase: 'loaded', trends, retrying: false });
    }, () => { if (id === discoveryId.current) setDiscovery({ phase: 'error', trends: [], retrying: false }); });
  }, [loadRange]);
  const requestDetail = useCallback((identity, nextRange, { focusResult = false, retrying = false } = {}) => {
    const id = ++detailId.current; const window = calendarRangeBounds({ range: nextRange, endDate: endDate() });
    setDetail({ phase: retrying ? 'error' : 'loading', trend: null, point: 0, focusResult, retrying, window });
    Promise.resolve(loadRange({ range: nextRange, endDate: window.endDate })).then(workouts => {
      if (id !== detailId.current) return;
      const trend = projectExerciseTrends(workouts).find(item => item.id === identity.id && item.trackingMode === identity.trackingMode) ?? null;
      setDetail({ phase: 'loaded', trend, point: Math.max(0, (trend?.points.length ?? 1) - 1), focusResult, retrying: false, window });
    }, () => { if (id === detailId.current) setDetail({ phase: 'error', trend: null, point: 0, focusResult, retrying: false, window }); });
  }, [loadRange]);
  useEffect(() => { requestDiscovery(); return () => { discoveryId.current += 1; detailId.current += 1; }; }, [requestDiscovery]);
  useEffect(() => { exercisesRef.current?.focus(); }, []);
  useEffect(() => { if (discovery.phase === 'loaded') filterRef.current?.focus(); }, [discovery.phase]);
  useEffect(() => { if (selected) headingRef.current?.focus(); }, [selected]);
  useEffect(() => { if (detail.phase === 'loaded' && detail.focusResult) (detail.trend ? summaryRef.current : emptyRef.current)?.focus(); }, [detail.focusResult, detail.phase, detail.trend]);

  const choose = item => { setSelected(item); setRange('3M'); requestDetail(item, '3M'); };
  const matching = discovery.trends.filter(item => item.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  if (!selected) return <section className="exercise-trends" aria-labelledby="exercises-heading">
    <h3 ref={exercisesRef} id="exercises-heading" tabIndex="-1">Exercises</h3>
    {discovery.phase === 'loading' && <p aria-live="polite">Loading exercises…</p>}
    {discovery.phase === 'error' && <div role="alert"><p>{discovery.retrying ? 'Retrying exercises…' : 'Couldn’t load exercises.'}</p><button type="button" disabled={discovery.retrying} aria-busy={discovery.retrying} onClick={() => requestDiscovery(true)}>Retry</button></div>}
    {discovery.phase === 'loaded' && <><label className="exercise-filter">Filter exercises by name<input ref={filterRef} value={filter} onChange={event => setFilter(event.target.value)} /></label>{discovery.trends.length === 0 ? <p>No eligible exercises in the last year.</p> : matching.length === 0 ? <p>No exercises match this filter.</p> : <ul className="exercise-trend-list">{matching.map(item => <li key={identityKey(item)}><button ref={element => { if (element) rows.current.set(identityKey(item), element); }} type="button" onClick={() => choose(item)}><strong>{item.name}</strong><span>{modeLabel(item.trackingMode)} · Last trained {formatDate(item.points.at(-1).date)}</span></button></li>)}</ul>}</>}</section>;

  const point = detail.trend?.points[detail.point];
  const setPoint = next => setDetail(current => ({ ...current, point: Math.max(0, Math.min(next, (current.trend?.points.length ?? 1) - 1)) }));
  const back = () => { const key = identityKey(selected); setSelected(null); setDetail({ phase: 'idle', trend: null, point: 0, focusResult: false, retrying: false }); setTimeout(() => { const target = rows.current.get(key); (target?.isConnected ? target : filterRef.current)?.focus(); }); };
  return <section className="exercise-trends" aria-labelledby="exercise-trend-heading"><button type="button" className="history-action" onClick={back}>Back to exercises</button><h3 ref={headingRef} id="exercise-trend-heading" tabIndex="-1">{selected.name}</h3><p>{modeLabel(selected.trackingMode)}</p><div className="trend-ranges" aria-label="Range">{ranges.map(item => <button type="button" aria-pressed={range === item} key={item} onClick={() => { setRange(item); requestDetail(selected, item, { focusResult: true }); }}>{item}</button>)}</div>{detail.phase === 'loading' && <p aria-live="polite">Loading {range} exercise history…</p>}{detail.phase === 'error' && <div role="alert"><p>{detail.retrying ? `Retrying ${range} exercise history…` : 'Couldn’t load exercise history.'}</p><button type="button" disabled={detail.retrying} aria-busy={detail.retrying} onClick={() => requestDetail(selected, range, { focusResult: true, retrying: true })}>Retry</button></div>}{detail.phase === 'loaded' && !detail.trend && <p ref={emptyRef} role="status" tabIndex="-1">No recorded workouts in this range.</p>}{detail.phase === 'loaded' && detail.trend && <TrendDetail summaryRef={summaryRef} trend={detail.trend} point={point} index={detail.point} window={detail.window} onPoint={setPoint} />}</section>;
}

function TrendPlot({ trend, index, window, onPoint }) {
  const points = trend.points;
  const first = new Date(`${window.startDate}T00:00:00Z`).getTime(); const span = new Date(`${window.endDate}T00:00:00Z`).getTime() - first;
  const x = item => 60 + ((new Date(`${visibleCalendarDate(item.date)}T00:00:00Z`).getTime() - first) / span) * 248;
  const series = trend.trackingMode === 'weighted'
    ? [{ key: 'value', label: 'Volume', dash: undefined, marker: 'circle' }]
    : [{ key: 'fullReps', label: 'Full', dash: undefined, marker: 'circle' }, { key: 'assistedReps', label: 'Assisted', dash: '7 5', marker: 'square' }, { key: 'eccentricReps', label: 'Eccentric', dash: '2 4', marker: 'diamond' }];
  const values = series.flatMap(item => points.map(point => point[item.key])); const minimum = Math.min(...values); const maximum = Math.max(...values);
  const spread = maximum - minimum || Math.max(Math.abs(maximum) * 0.1, 1);
  const magnitude = 10 ** Math.floor(Math.log10(spread / 3)); const step = Math.max(1, magnitude * ([1, 2, 5, 10].find(item => item * magnitude >= spread / 3)));
  let lower = Math.max(0, Math.floor(minimum / step) * step); let upper = Math.ceil(maximum / step) * step;
  if (lower === upper) { lower = Math.max(0, lower - step); upper += step; }
  const ticks = Array.from({ length: Math.round((upper - lower) / step) + 1 }, (_, item) => lower + item * step);
  const y = value => 132 - ((value - lower) / (upper - lower)) * 104;
  const unit = trend.trackingMode === 'weighted' ? 'lb' : 'reps';
  const title = trend.trackingMode === 'weighted' ? 'Workout volume (lb)' : 'Reps by type';
  const path = key => points.map((item, itemIndex) => `${itemIndex ? 'L' : 'M'} ${x(item)} ${y(item[key])}`).join(' ');
  const chooseNearest = event => { const box = event.currentTarget.getBoundingClientRect(); const pointerX = ((event.clientX - box.left) / (box.width || 320)) * 320; onPoint(points.reduce((nearest, item, itemIndex) => Math.abs(x(item) - pointerX) < Math.abs(x(points[nearest]) - pointerX) ? itemIndex : nearest, 0)); };
  const marker = (item, itemIndex, seriesItem) => {
    const cx = x(item); const cy = y(item[seriesItem.key]); const active = itemIndex === index;
    if (seriesItem.marker === 'square') return <rect key={seriesItem.key} className={active ? 'trend-marker is-selected' : 'trend-marker'} x={cx - 4} y={cy - 4} width="8" height="8" data-series={seriesItem.key} />;
    if (seriesItem.marker === 'diamond') return <path key={seriesItem.key} className={active ? 'trend-marker is-selected' : 'trend-marker'} d={`M ${cx} ${cy - 5} L ${cx + 5} ${cy} L ${cx} ${cy + 5} L ${cx - 5} ${cy} Z`} data-series={seriesItem.key} />;
    return <circle key={seriesItem.key} className={active ? 'trend-marker is-selected' : 'trend-marker'} cx={cx} cy={cy} r="4" data-series={seriesItem.key} />;
  };
  return <figure className="trend-plot"><figcaption><h4 className="trend-plot-title">{title}</h4>{trend.trackingMode === 'bodyweight' && <div className="trend-plot-key" aria-label="Series">{series.map(item => <span className="trend-key-item" key={item.key}><span className={`trend-key-swatch is-${item.key.replace('Reps', '')}`} aria-hidden="true" />{item.label}</span>)}</div>}</figcaption><p className="trend-selected-workout">Selected workout: {formatDate(points[index].date)}</p><svg data-testid="trend-plot" aria-hidden="true" viewBox="0 0 320 152" preserveAspectRatio="xMidYMid meet" onPointerDown={chooseNearest}>{ticks.map(value => <g key={value}><line className="trend-gridline" x1="60" x2="308" y1={y(value)} y2={y(value)} /><text data-y-tick="true" className="trend-y-tick" x="54" y={y(value) + 3} textAnchor="end">{value} {value === 1 && unit === 'reps' ? 'rep' : unit}</text></g>)}{series.map(item => <path key={item.key} className="trend-line" d={path(item.key)} strokeDasharray={item.dash} />)}{points.map((item, itemIndex) => <g key={item.workoutId} data-point-index={itemIndex} data-point-x={x(item)}>{series.map(seriesItem => marker(item, itemIndex, seriesItem))}</g>)}</svg><div className="trend-plot-dates"><span>{formatDate(window.startDate)}</span><span>{formatDate(window.endDate)}</span></div></figure>;
}

function TrendDetail({ summaryRef, trend, point, index, window, onPoint }) {
  const points = trend.points; const latest = points.at(-1); const previous = points[index - 1]; const one = points.length === 1;
  const move = event => { const keys = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: points.length - 1 }; if (keys[event.key] !== undefined) { event.preventDefault(); onPoint(keys[event.key]); } };
  return <><section aria-labelledby="trend-summary-heading"><h4 ref={summaryRef} id="trend-summary-heading" tabIndex="-1">Recorded facts</h4>{trend.trackingMode === 'weighted' ? <><p>Latest volume: {latest.value} lb</p><p>Range high: {Math.max(...points.map(item => item.value))} lb</p>{previous && <p>Since {formatShortDate(previous.date)}: {volumeChange(point.value, previous.value)}</p>}</> : <><p>Latest totals: {pointLabel(latest)}</p><p>Highest full reps in one workout: {Math.max(...points.map(item => item.fullReps))}</p><p>Highest assisted reps in one workout: {Math.max(...points.map(item => item.assistedReps))}</p><p>Highest eccentric reps in one workout: {Math.max(...points.map(item => item.eccentricReps))}</p>{previous && <p>Since {formatShortDate(previous.date)}: Full {signed(point.fullReps - previous.fullReps)} · Assisted {signed(point.assistedReps - previous.assistedReps)} · Eccentric {signed(point.eccentricReps - previous.eccentricReps)}</p>}</>}{one ? <p>One recorded workout in this range.</p> : <p>Sessions: {points.length}</p>}</section><TrendPlot trend={trend} index={index} window={window} onPoint={onPoint} /><label className="trend-scrubber">Recorded workout {index + 1} of {points.length}: {formatDate(point.date)} · {pointLabel(point)}<input aria-label="Recorded workout" type="range" min="0" max={points.length - 1} value={index} onChange={event => onPoint(Number(event.target.value))} onKeyDown={move} /></label><p aria-live="polite">Selected {formatDate(point.date)}: {pointLabel(point)}</p><section aria-labelledby="confirmed-set-heading"><h4 id="confirmed-set-heading">Confirmed sets</h4><ul>{point.confirmedSets.map((set, setIndex) => <li key={setIndex}>{trend.trackingMode === 'weighted' ? `${set.actualWeight} lb × ${set.actualReps} reps` : `Full ${set.fullReps} · Assisted ${set.assistedReps} · Eccentric ${set.eccentricReps}`}</li>)}</ul></section></>;
}
