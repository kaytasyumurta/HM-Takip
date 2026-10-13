'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/format'
import Icon from '@/components/Icon'

export default function ExtendLicense({ companyId }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function apply(e) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { data, error } = await supabase.rpc('redeem_extension_key', { p_company: companyId, p_key: key })
    if (error) setMsg({ type: 'error', text: error.message })
    else if (!data?.ok) setMsg({ type: 'error', text: data?.error || 'İşlem başarısız.' })
    else {
      setMsg({ type: 'ok', text: `Lisans uzatıldı. Yeni bitiş tarihi: ${fmtDate(data.new_end)}` })
      setKey(''); router.refresh()
    }
    setBusy(false)
  }

  return (
    <form onSubmit={apply} style={{ textAlign: 'left' }}>
      <label>Lisans uzatma anahtarı</label>
      <div className="input-icon">
        <Icon name="key" size={18} />
        <input value={key} onChange={e => setKey(e.target.value)} placeholder="EXT-XXXXX-XXXXX-XXXXX-XXXXX" required autoComplete="off" />
      </div>
      {msg && <div className={msg.type === 'error' ? 'error' : 'notice'} style={{ marginTop: 12 }}>{msg.text}</div>}
      <div style={{ marginTop: 14 }}>
        <button className="btn btn-primary" disabled={busy}><Icon name="check" size={16} /> Anahtarı uygula</button>
      </div>
    </form>
  )
}
