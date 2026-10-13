import { redirect } from 'next/navigation'
import { getContext } from '@/lib/session'
import { licenseState, fmtDate } from '@/lib/format'
import Nav from '@/components/Nav'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }) {
  const ctx = await getContext()
  if (!ctx.user) redirect('/login')
  if (!ctx.active) redirect(ctx.profile?.is_super_admin ? '/admin' : '/no-access')

  const { company, role } = ctx.active
  const state = licenseState(company)
  const blocked = state === 'expired' || state === 'passive'

  return (
    <div>
      <Nav company={company} role={role} name={ctx.profile?.full_name || ctx.profile?.email}
        blocked={blocked} isSuper={!!ctx.profile?.is_super_admin} />
      <main className="container">
        {blocked ? (
          <div className="card">
            <h1>{state === 'passive' ? 'Firma Erişimi Kapalı' : 'Lisans Süresi Doldu'}</h1>
            <p className="muted">
              {state === 'passive'
                ? 'Firmanızın erişimi yazılım yöneticisi tarafından geçici olarak kapatılmıştır.'
                : 'Firmanızın lisans süresi sona ermiştir. Verileriniz silinmemiştir; lisans uzatıldığında kaldığınız yerden devam edebilirsiniz.'}
            </p>
            {role === 'company_admin' && <p>Lisans bitiş tarihi: <strong>{fmtDate(company.license_end)}</strong>. Uzatma için yazılım geliştiricisiyle iletişime geçin.</p>}
          </div>
        ) : children}
      </main>
    </div>
  )
}
