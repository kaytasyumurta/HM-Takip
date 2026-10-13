import Link from 'next/link'
import { getContext } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { daysLeft, fmtDate, licenseState, LICENSE_TR } from '@/lib/format'
import PageHeader from '@/components/PageHeader'
import Icon from '@/components/Icon'

export default async function Home() {
  const { active } = await getContext()
  const { company, role } = active
  const supabase = createClient()
  const left = daysLeft(company.license_end)
  const state = licenseState(company)
  const total = Math.max(1, Math.ceil((new Date(company.license_end) - new Date(company.license_start)) / 86400000))
  const pct = Math.min(100, Math.max(0, Math.round((left / total) * 100)))
  const manager = ['company_admin', 'purchasing'].includes(role)

  const head = { count: 'exact', head: true }
  const [act, done, unk, pend] = await Promise.all([
    manager ? supabase.from('supply_orders').select('*', head).eq('company_id', company.id).in('status', ['active', 'partial']) : { count: 0 },
    manager ? supabase.from('supply_orders').select('*', head).eq('company_id', company.id).eq('status', 'completed') : { count: 0 },
    manager ? supabase.from('supply_orders').select('*', head).eq('company_id', company.id).eq('freight_model', 'unknown').neq('status', 'cancelled') : { count: 0 },
    role === 'company_admin' ? supabase.from('join_requests').select('*', head).eq('company_id', company.id).eq('status', 'pending') : { count: 0 },
  ])

  return (
    <div>
      <PageHeader icon="home" title="Ana Sayfa" subtitle={`${company.name} kontrol paneli`} />

      {role === 'company_admin' && (pend.count || 0) > 0 && (
        <div className="banner info">
          <Icon name="userplus" />
          <span>{pend.count} kişi firmanıza katılmak için onay bekliyor.</span>
          <Link href="/members" className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>Başvuruları incele</Link>
        </div>
      )}

      {manager && (
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-icon"><Icon name="truck" size={24} /></div><div><div className="stat-label">Aktif tedarik</div><div className="stat-value">{act.count || 0}</div></div></div>
          <div className="stat-card"><div className="stat-icon"><Icon name="check" size={24} /></div><div><div className="stat-label">Tamamlanan tedarik</div><div className="stat-value">{done.count || 0}</div></div></div>
          <div className="stat-card"><div className="stat-icon"><Icon name="alert" size={24} /></div><div><div className="stat-label">Nakliyesi belirsiz</div><div className="stat-value">{unk.count || 0}</div></div></div>
        </div>
      )}

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
          <div><div className="stat-label">Kalan süre</div><div className="stat-value">{left} gün</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icon name="calendar" size={24} /></div>
          <div><div className="stat-label">Lisans bitiş tarihi</div><div className="stat-value" style={{ fontSize: 22 }}>{fmtDate(company.license_end)}</div></div>
        </div>
      </div>

      <div className="card">
        <strong>Lisans süresi</strong>
        <div className={`progress ${left <= 7 ? 'soon' : ''}`}><span style={{ width: `${pct}%` }} /></div>
        <div className="muted" style={{ fontSize: 13 }}>{fmtDate(company.license_start)} - {fmtDate(company.license_end)} · %{pct} kaldı</div>
      </div>
    </div>
  )
}
