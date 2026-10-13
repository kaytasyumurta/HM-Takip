import { redirect } from 'next/navigation'
import { getContext } from '@/lib/session'
import { licenseState, fmtDate, ROLE_SHORT } from '@/lib/format'
import AppShell from '@/components/AppShell'
import Icon from '@/components/Icon'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }) {
  const ctx = await getContext()
  if (!ctx.user) redirect('/login')
  if (!ctx.active) redirect(ctx.profile?.is_super_admin ? '/admin' : '/no-access')

  const { company, role } = ctx.active
  const state = licenseState(company)
  const blocked = state === 'expired' || state === 'passive'

  const items = []
  if (!blocked) {
    items.push({ href: '/', label: 'Ana Sayfa', icon: 'home' })
    if (role === 'company_admin') items.push({ href: '/members', label: 'Kullanıcılar', icon: 'users' })
    items.push(
      { label: 'Hammadde Tedarik', icon: 'truck', disabled: true },
      { label: 'Kantar Kayıtları', icon: 'scale', disabled: true },
      { label: 'Raporlar', icon: 'chart', disabled: true },
    )
  }
  if (ctx.profile?.is_super_admin) items.push({ href: '/admin', label: 'Süper Yönetici', icon: 'shield' })

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
        </div>
      ) : children}
    </AppShell>
  )
}
