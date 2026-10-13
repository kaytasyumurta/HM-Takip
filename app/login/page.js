'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/Icon'
import { BRAND } from '@/lib/brand'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [superMode, setSuperMode] = useState(false)
  const [company, setCompany] = useState(null)
  const [code, setCode] = useState('')
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function findCompany(e) {
    e.preventDefault(); setError(''); setBusy(true)
    const { data, error } = await supabase.rpc('lookup_company', { p_code: code })
    if (error || !data || !data.length) setError('Firma bulunamadı. Firma kodunu kontrol edin.')
    else setCompany(data[0])
    setBusy(false)
  }

  // Firmaya üye değilse: başvuru oluştur, yönetici onayını bekle
  async function applyToCompany() {
    const { data, error } = await supabase.rpc('request_to_join', { p_company: company.id })
    await supabase.auth.signOut()
    setMode('login')
    if (error) setError(error.message)
    else if (!data?.ok) setError(data?.error || 'Başvuru oluşturulamadı.')
    else if (data.state === 'pending') setInfo('Başvurunuz zaten firma yöneticisinin onayını bekliyor. Onaylandığında bu e-posta ve şifreyle giriş yapabilirsiniz.')
    else setInfo('Başvurunuz firma yöneticisine iletildi. Onaylandığında bu e-posta ve şifreyle giriş yapabilirsiniz.')
  }

  async function finishLogin(userId) {
    const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', userId).single()
    if (superMode) {
      if (profile?.is_super_admin) { router.push('/admin'); router.refresh(); return }
      await supabase.auth.signOut()
      setError('Bu hesabın süper yönetici yetkisi yok.')
      return
    }
    const { data: m } = await supabase.from('memberships').select('id')
      .eq('company_id', company.id).eq('user_id', userId).eq('active', true)
    if (!m || !m.length) { await applyToCompany(); return }
    document.cookie = `active_company=${company.id}; path=/; max-age=2592000; samesite=lax`
    router.push('/'); router.refresh()
  }

  async function submit(e) {
    e.preventDefault(); setError(''); setInfo(''); setBusy(true)
    if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Giriş başarısız: e-posta veya şifre hatalı.')
      else await finishLogin(data.user.id)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      if (error) setError(error.message)
      else if (data.session) {
        const { data: p } = await supabase.from('profiles').select('is_super_admin').eq('id', data.user.id).single()
        if (p?.is_super_admin) { router.push('/admin'); router.refresh() }
        else if (!superMode) await applyToCompany()
        else {
          await supabase.auth.signOut()
          setMode('login')
          setInfo('Hesap oluşturuldu ancak süper yönetici yetkisi yok.')
        }
      } else setInfo('Kayıt alındı. E-postanıza gelen doğrulama bağlantısına tıklayın, ardından giriş yaparak başvurunuzu tamamlayın.')
    }
    setBusy(false)
  }

  const Brand = (
    <div className="auth-brand">
      <div className="logo">{BRAND.letter}</div>
      <div><div className="brand-name">{BRAND.name}</div><div className="brand-sub">{BRAND.sub}</div></div>
    </div>
  )

  if (!superMode && !company) {
    return (
      <div className="auth-wrap">
        {Brand}
        <form className="auth-card" onSubmit={findCompany}>
          <h1>Firma seçimi</h1>
          <p className="sub">Devam etmek için firma kodunuzu girin.</p>
          <div className="field">
            <label>Firma kodu</label>
            <div className="input-icon">
              <Icon name="building" size={18} />
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="Örn: KAYMER" required autoFocus />
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="auth-actions">
            <button className="btn btn-primary" disabled={busy}>Devam et</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setSuperMode(true); setError('') }}>
              <Icon name="shield" size={16} /> Süper yönetici girişi
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      {Brand}
      <form className="auth-card" onSubmit={submit}>
        <h1>{superMode ? 'Süper yönetici' : company.name}</h1>
        <p className="sub">
          {mode === 'login' ? 'Hesabınızla giriş yapın.' : superMode ? 'Yeni hesap oluşturun.' : 'Hesap oluşturup firmaya katılma başvurusu yapın. Başvurunuzu firma yöneticisi onaylar.'}
        </p>
        {mode === 'register' && (
          <div className="field">
            <label>Ad soyad</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
        )}
        <div className="field">
          <label>E-posta</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Şifre (en az 6 karakter)</label>
          <input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        {error && <div className="error">{error}</div>}
        {info && <div className="notice">{info}</div>}
        <div className="auth-actions">
          <button className="btn btn-primary" disabled={busy}>{mode === 'login' ? 'Giriş yap' : superMode ? 'Hesap oluştur' : 'Başvuru yap'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo('') }}>
            {mode === 'login' ? 'Hesap oluştur' : 'Girişe dön'}
          </button>
        </div>
        <div className="auth-link">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCompany(null); setSuperMode(false); setError(''); setInfo('') }}>
            <Icon name="back" size={15} /> Firma seçimine dön
          </button>
        </div>
      </form>
    </div>
  )
}
