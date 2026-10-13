import { getContext } from '@/lib/session'
import { daysLeft, fmtDate, licenseState, LICENSE_TR } from '@/lib/format'
import PageHeader from '@/components/PageHeader'
import Icon from '@/components/Icon'
import ExtendLicense from '@/components/ExtendLicense'
import LicenseHistory from '@/components/LicenseHistory'

export const dynamic = 'force-dynamic'

export default async function LicensePage() {
  const { active } = await getContext()
  if (active.role !== 'company_admin') return <div className="error">Bu sayfaya erişim yetkiniz yok.</div>
  const company = active.company
  const left = daysLeft(company.license_end)
  const state = licenseState(company)
  return (
    <div>
      <PageHeader icon="key" title="Lisans" subtitle="Lisans durumunuzu görün, uzatma anahtarını girin." />
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon"><Icon name="check" size={24} /></div>
          <div><div className="stat-label">Lisans durumu</div><div style={{ marginTop: 6 }}><span className={`status ${state}`}><i />{LICENSE_TR[state]}</span></div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icon name="clock" size={24} /></div>
          <div><div className="stat-label">Kalan süre</div><div className="stat-value">{left} gün</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icon name="calendar" size={24} /></div>
          <div><div className="stat-label">Bitiş tarihi</div><div className="stat-value" style={{ fontSize: 22 }}>{fmtDate(company.license_end)}</div></div>
        </div>
      </div>

      <div className="card">
        <strong>Lisansı uzat</strong>
        <p className="muted" style={{ marginTop: 6 }}>Uzatma için yazılım geliştiricisiyle iletişime geçin. Size verilen anahtarı aşağıya girin. Lisansınız bitmemişse süre kalan günlerin üzerine eklenir.</p>
        <ExtendLicense companyId={company.id} />
      </div>

      <h2 style={{ fontSize: 18, margin: '24px 0 12px' }}>Lisans geçmişi</h2>
      <LicenseHistory companyId={company.id} companyView />
    </div>
  )
}
