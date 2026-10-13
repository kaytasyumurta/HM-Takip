'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
    if (!m || !m.length) {
      await supabase.auth.signOut()
      setError('Bu firmaya üyeliğiniz yok. Firma yöneticinizden sizi eklemesini isteyin.')
      return
    }
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
        else {
          await supabase.auth.signOut()
          setMode('login')
          setInfo('Hesabınız oluşturuldu. Firma yöneticiniz sizi firmaya ekledikten sonra giriş yapabilirsiniz.')
        }
      } else setInfo('Kayıt alındı. E-postanıza gelen doğrulama bağlantısına tıklayın.')
    }
    setBusy(false)
  }

  if (!superMode && !company) {
    return (
      <div className="center">
        <form className="card auth" onSubmit={findCompany}>
          <h1>Firma Seçimi</h1>
          <div className="field">
            <label>Firma kodunu giriniz</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="Örn: KAYMER" required />
          </div>
          {error && <div className="error">{error}</div>}
          <div className="row">
            <button disabled={busy}>Devam Et</button>
            <button type="button" className="ghost" onClick={() => { setSuperMode(true); setError('') }}>Süper yönetici girişi</button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="center">
      <form className="card auth" onSubmit={submit}>
        <h1>{superMode ? 'Süper Yönetici' : company.name}</h1>
        <p className="muted" style={{ marginTop: -8 }}>{mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}</p>
        {mode === 'register' && (
          <div className="field">
            <label>Ad Soyad</label>
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
        {info && <div className="muted">{info}</div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button disabled={busy}>{mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}</button>
          <button type="button" className="ghost" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo('') }}>
            {mode === 'login' ? 'Hesap oluştur' : 'Girişe dön'}
          </button>
        </div>
        <div className="row">
          <button type="button" className="ghost" onClick={() => { setCompany(null); setSuperMode(false); setError(''); setInfo('') }}>← Firma seçimine dön</button>
        </div>
      </form>
    </div>
  )
}
