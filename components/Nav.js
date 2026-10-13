import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { ROLE_TR } from '@/lib/format'

export default function Nav({ company, role, name, blocked, isSuper }) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <strong>{company.name}</strong>
        {!blocked && <Link href="/">Ana Sayfa</Link>}
        {!blocked && role === 'company_admin' && <Link href="/members">Kullanıcılar</Link>}
        {isSuper && <Link href="/admin">Süper Yönetici</Link>}
        <span className="spacer" />
        <span className="muted">{name} ({ROLE_TR[role]})</span>
        <LogoutButton />
      </div>
    </nav>
  )
}
