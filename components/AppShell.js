'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import LogoutButton from '@/components/LogoutButton'
import { BRAND } from '@/lib/brand'

export default function AppShell({ items, contextLabel, userName, roleLabel, children }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState('dark')

  useEffect(() => { setTheme(document.documentElement.getAttribute('data-theme') || 'dark') }, [])
  useEffect(() => { setMobileOpen(false) }, [pathname])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('theme', next) } catch {}
  }
  function toggleMenu() {
    if (window.matchMedia('(max-width: 900px)').matches) setMobileOpen(o => !o)
    else setCollapsed(c => !c)
  }

  const initials = (userName || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toLocaleUpperCase('tr-TR')
  const matches = items.filter(i => i.href && (i.href === '/' ? pathname === '/' : pathname === i.href || pathname.startsWith(i.href + '/')))
  const best = matches.sort((a, b) => b.href.length - a.href.length)[0]?.href
  const isActive = href => href === best

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <header className="topbar">
        <button className="icon-btn" onClick={toggleMenu} aria-label="Menüyü aç/kapat"><Icon name="menu" /></button>
        <div className="brand">
          <div className="logo">{BRAND.letter}</div>
          <div>
            <div className="brand-name">{BRAND.name}</div>
            <div className="brand-sub">{BRAND.sub}</div>
          </div>
        </div>
        {contextLabel && <div className="context-chip"><Icon name="building" size={15} />{contextLabel}</div>}
        <span className="spacer" />
        <button className="icon-btn" onClick={toggleTheme} title="Tema değiştir" aria-label="Tema değiştir">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <div className="user-chip">
          <div className="avatar">{initials}</div>
          <div className="user-meta">
            <div className="user-name">{userName}</div>
            <span className="role-badge">{roleLabel}</span>
          </div>
        </div>
        <LogoutButton iconOnly />
      </header>

      <div className="body">
        <div className="scrim" onClick={() => setMobileOpen(false)} />
        <aside className="sidebar">
          <nav>
            {items.map(it => it.disabled ? (
              <div key={it.label} className="nav-item disabled" title="Sonraki aşamada eklenecek">
                <Icon name={it.icon} size={20} />
                <span className="nav-label">{it.label}</span>
                <span className="soon-tag">Yakında</span>
              </div>
            ) : (
              <Link key={it.href} href={it.href} className={`nav-item ${isActive(it.href) ? 'active' : ''}`}>
                <Icon name={it.icon} size={20} />
                <span className="nav-label">{it.label}</span>
              </Link>
            ))}
          </nav>
          <svg className="side-wave" viewBox="0 0 252 220" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 150 C60 100 120 70 252 40 L252 220 L0 220 Z" fill="rgba(37,99,235,.12)" />
            <path d="M0 175 C70 150 140 120 252 95 L252 220 L0 220 Z" fill="rgba(109,75,245,.1)" />
          </svg>
          <div className="side-foot">
            <div className="dot-ic"><Icon name="layers" size={16} /></div>
            <span className="side-foot-text">{BRAND.tagline}</span>
          </div>
        </aside>

        <div className="content">
          <main className="container">{children}</main>
          <footer className="footer">
            <span>{BRAND.name} © {new Date().getFullYear()} | Bulut tabanlı tedarik ve kantar takip</span>
            <span className="live"><i /> Sistem aktif</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
