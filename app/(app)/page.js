import { getContext } from '@/lib/session'
import { daysLeft, fmtDate, licenseState, LICENSE_TR } from '@/lib/format'
import PageHeader from '@/components/PageHeader'
import Icon from '@/components/Icon'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { active } = await getContext()
  const { company, role } = active
  const left = daysLeft(company.license_end)
  const state = licenseState(company)
  const total = Math.max(1, Math.ceil((new Date(company.license_end) - new Date(company.license_start)) / 86400000))
  const pct = Math.min(100, Math.max(0, Math.round((left / total) * 100)))

  return (
    <div>
      <PageHeader icon="home" title="Ana Sayfa" subtitle={`${company.name} kontrol paneli`} />

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon"><Icon name="check" size={24} /></div>
          <div>
            <div className="stat-label">Lisans durumu</div>
            <div style={{ marginTop: 6 }}><span className={`status ${state}`}><i />{LICENSE_TR[state]}</span></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icon name="clock" size={24} /></div>
          <div>
            <div className="stat-label">Kalan süre</div>
            <div className="stat-value">{left} gün</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icon name="calendar" size={24} /></div>
          <div>
            <div className="stat-label">Lisans bitiş tarihi</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{fmtDate(company.license_end)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <strong>Lisans süresi</strong>
        <div className={`progress ${left <= 7 ? 'soon' : ''}`}><span style={{ width: `${pct}%` }} /></div>
        <div className="muted" style={{ fontSize: 13 }}>{fmtDate(company.license_start)} - {fmtDate(company.license_end)} · %{pct} kaldı</div>
      </div>

      <div className="card">
        <strong>Yakında eklenecek modüller</strong>
        <div className="module-list">
          <div className="module"><Icon name="truck" /> Hammadde tedarik yönetimi</div>
          <div className="module"><Icon name="scale" /> Kantar ve araç kayıtları</div>
          <div className="module"><Icon name="chart" /> Raporlar ve Excel çıktısı</div>
        </div>
      </div>
    </div>
  )
}
