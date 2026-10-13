import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getContext } from '@/lib/session'
import LogoutButton from '@/components/LogoutButton'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }) {
  const ctx = await getContext()
  if (!ctx.user) redirect('/login')
  if (!ctx.profile?.is_super_admin) redirect('/')
  return (
    <div>
      <nav className="nav">
        <div className="nav-inner">
          <strong>Süper Yönetici Paneli</strong>
          <Link href="/admin">Firmalar</Link>
          <span className="spacer" />
          <span className="muted">{ctx.profile.email}</span>
          <LogoutButton />
        </div>
      </nav>
      <main className="container">{children}</main>
    </div>
  )
}
