export default function ProgressBar({ pct, over }) {
  const w = Math.min(100, Math.max(0, pct))
  return (
    <div className="pbar-wrap">
      <div className={`pbar ${over ? 'over' : pct >= 100 ? 'full' : ''}`}><span style={{ width: `${w}%` }} /></div>
      <span className="pbar-txt">%{Math.round(pct)}</span>
    </div>
  )
}
