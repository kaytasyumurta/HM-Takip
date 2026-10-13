import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getContext } from '@/lib/session'
import { licenseState, fmtDate, daysLeft, ROLE_SHORT } from '@/lib/format'
import AppShell from '@/components/AppShell'
import Icon from '@/components/Icon'
import ExtendLicense from '@/components/ExtendLicense'

export default async function AppLayout({ children }) {
  const ctx = await getContext()
  if (!ctx.user) redirect('/login')
  if (!ctx.active) redirect(ctx.profile?.is_super_admin ? '/admin' : '/no-access')

  const { company, role } = ctx.active
  const state = licenseState(company)
  const blocked = state === 'expired' || state === 'passive'
  const left = daysLeft(company.license_end)

  const items = []
  const manager = ['company_admin', 'purchasing'].includes(role)
  if (!blocked) {
    items.push({ href: '/', label: 'Ana Sayfa', icon: 'home' })
    if (manager) {
      items.push({ href: '/supplies', label: 'Hammadde Tedarik', icon: 'truck' })
      items.push({ href: '/suppliers', label: 'Tedarikçiler', icon: 'building' })
      items.push({ href: '/products', label: 'Ürünler', icon: 'layers' })
    }
    items.push({ href: '/weighbridge', label: 'Kantar Kayıtları', icon: 'scale' })
    items.push({ label: 'Raporlar', icon: 'chart', disabled: true })
    if (role === 'company_admin') {
      items.push({ href: '/members', label: 'Kullanıcılar', icon: 'users' })
      items.push({ href: '/license', label: 'Lisans', icon: 'key' })
    }
  }
  if (ctx.profile?.is_super_admin) items.push({ href: '/admin', label: 'Süper Yönetici', icon: 'shield' })

  const showBanner = !blocked && role === 'company_admin' && left <= 7

  return (
    <AppShell items={items} contextLabel={company.name}
      userName={ctx.profile?.full_name || ctx.profile?.email} roleLabel={ROLE_SHORT[role]}>
      {blocked ? (
        <div className="card state-card">
          <div className="ph-icon"><Icon name={state === 'passive' ? 'ban' : 'clock'} size={28} /></div>
          <h1 style={{ fontSize: 24, marginBottom: 10 }}>{state === 'passive' ? 'Firma erişimi kapalı' : 'Lisans süresi doldu'}</h1>
          <p className="muted">
            {state === 'passive'
              ? 'Firmanızın erişimi yazılım yöneticisi tarafından geçici olarak kapatılmıştır.'
              : 'Firmanızın lisans süresi sona ermiştir. Verileriniz silinmemiştir; lisans uzatıldığında kaldığınız yerden devam edebilirsiniz.'}
          </p>
          {role === 'company_admin' && (
            <p>Lisans bitiş tarihi: <strong>{fmtDate(company.license_end)}</strong>. Uzatma için yazılım geliştiricisiyle iletişime geçin.</p>
          )}
          {role === 'company_admin' && state === 'expired' && (
            <div style={{ marginTop: 20 }}>
              <ExtendLicense companyId={company.id} />
            </div>
          )}
        </div>
      ) : (
        <>
          {showBanner && (
            <div className={`banner ${left <= 3 ? 'danger' : ''}`}>
              <Icon name="alert" />
              <span>{left <= 1 ? 'Lisansınız 1 gün içinde sona erecek.' : `Lisansınızın bitmesine ${left} gün kaldı.`}</span>
              <Link href="/license" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>Lisansı uzat</Link>
            </div>
          )}
          {children}
        </>
      )}
    </AppShell>
  )
}
