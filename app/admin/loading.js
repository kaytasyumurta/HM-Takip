export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="skeleton" style={{ height: 108, marginBottom: 18 }} />
      <div className="stat-grid">
        <div className="skeleton" style={{ height: 92 }} />
        <div className="skeleton" style={{ height: 92 }} />
        <div className="skeleton" style={{ height: 92 }} />
      </div>
      <div className="skeleton" style={{ height: 280 }} />
    </div>
  )
}
