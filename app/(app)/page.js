import { getContext } from '@/lib/session'
import { daysLeft, fmtDate, licenseState, LICENSE_TR } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { active } = await getContext()
  const { company, role } = active
  const left = daysLeft(company.license_end)
  const state = licenseState(company)
  return (
    <div>
      <h1>Ana Sayfa</h1>
      {role === 'company_admin' && left <= 7 && (
        <div className="banner">Lisans süreniz {left} gün sonra sona erecek. Uzatma için yazılım geliştiricisiyle iletişime geçin.</div>
      )}
      <div className="grid">
        <div className="card">
          <div className="muted">Lisans durumu</div>
          <div><span className={`badge ${state}`}>{LICENSE_TR[state]}</span></div>
        </div>
        <div className="card">
          <div className="muted">Kalan süre</div>
          <div className="stat">{left} gün</div>
        </div>
        <div className="card">
          <div className="muted">Lisans bitiş tarihi</div>
          <div className="stat" style={{ fontSize: 22 }}>{fmtDate(company.license_end)}</div>
        </div>
      </div>
      <p className="muted">Tedarik, kantar ve raporlama modülleri sonraki aşamalarda eklenecek.</p>
    </div>
  )
}
