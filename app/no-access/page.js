import LogoutButton from '@/components/LogoutButton'
import Icon from '@/components/Icon'
import { BRAND } from '@/lib/brand'

export default function NoAccess() {
  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <div className="logo">{BRAND.letter}</div>
        <div><div className="brand-name">{BRAND.name}</div><div className="brand-sub">{BRAND.sub}</div></div>
      </div>
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="ph-icon" style={{ margin: '0 auto 16px' }}><Icon name="ban" size={28} /></div>
        <h1>Firma üyeliği yok</h1>
        <p className="sub">Hesabınız henüz onaylı bir firmaya bağlı değil. Başvurunuz yönetici onayını bekliyor olabilir. Onaylandığında tekrar giriş yapın.</p>
        <LogoutButton />
      </div>
    </div>
  )
}
