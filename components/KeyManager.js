'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/format'
import Icon from '@/components/Icon'
import Modal from '@/components/Modal'

function keyState(k) {
  if (k.status === 'revoked') return ['expired', 'İptal edildi']
  if (k.status === 'used') return ['used', 'Kullanıldı']
  if (k.expires_at && new Date(k.expires_at) < new Date()) return ['expired', 'Süresi doldu']
  return ['active', 'Aktif']
}

export default function KeyManager({ companyId }) {
  const supabase = useMemo(() => createClient(), [])
  const [keys, setKeys] = useState([])
  const [companies, setCompanies] = useState([])
  const [form, setForm] = useState(null)
  const [created, setCreated] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    let q = supabase.from('license_keys').select('*').order('created_at', { ascending: false })
    if (companyId) q = q.eq('company_id', companyId)
    const [k, c] = await Promise.all([q, supabase.from('companies').select('id, name, code')])
    if (k.error) setError(k.error.message); else setKeys(k.data || [])
    setCompanies(c.data || [])
  }
  useEffect(() => { load() }, [companyId])

  const cname = id => companies.find(c => c.id === id)?.name || '-'

  function openForm() {
    setError('')
    setForm({ company: companyId || '', days: 30, expires: '', note: '' })
  }

  async function create(e) {
    e.preventDefault(); setError('')
    const { data, error } = await supabase.rpc('create_license_key', {
      p_company: form.company, p_kind: 'extension', p_days: Number(form.days), p_role: null, p_max_uses: 1,
      p_expires: form.expires ? new Date(form.expires + 'T23:59:59').toISOString() : null, p_note: form.note,
    })
    if (error) { setError(error.message); return }
    setCreated({ key: data, company: cname(form.company), days: form.days })
    setCopied(false); setForm(null); load()
  }

  async function revoke(k) {
    if (!confirm('Bu anahtar iptal edilsin mi? İptal edilen anahtar bir daha kullanılamaz.')) return
    const { error } = await supabase.rpc('revoke_license_key', { p_key: k.id })
    if (error) setError(error.message)
    load()
  }

  async function copy() {
    try { await navigator.clipboard.writeText(created.key); setCopied(true) } catch { setCopied(false) }
  }

  return (
    <div>
      <div className="row">
        <button className="btn btn-primary" onClick={openForm}><Icon name="plus" size={18} /> Yeni uzatma anahtarı</button>
      </div>
      {error && !form && <div className="error">{error}</div>}

      <div className="table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{!companyId && <th>FİRMA</th>}<th>ANAHTAR</th><th>SÜRE</th><th>DURUM</th><th>OLUŞTURULMA</th><th>KULLANIM TARİHİ</th><th>NOT</th><th>İŞLEM</th></tr>
            </thead>
            <tbody>
              {keys.filter(k => k.kind === 'extension').map(k => {
                const [cls, label] = keyState(k)
                return (
                  <tr key={k.id}>
                    {!companyId && <td className="td-strong">{cname(k.company_id)}</td>}
                    <td style={{ fontFamily: 'monospace' }}>EXT-•••••-{k.key_hint}</td>
                    <td>{k.duration_days} gün</td>
                    <td><span className={`status ${cls}`}><i />{label}</span></td>
                    <td>{fmtDate(k.created_at)}</td>
                    <td>{k.used_at ? fmtDate(k.used_at) : '-'}</td>
                    <td className="muted">{k.note || '-'}</td>
                    <td>
                      {k.status === 'active' && (
                        <button className="btn btn-red btn-sm" onClick={() => revoke(k)}><Icon name="ban" size={15} /> İptal et</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!keys.some(k => k.kind === 'extension') && <tr><td colSpan={companyId ? 7 : 8} className="empty">Henüz anahtar yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title="Yeni lisans uzatma anahtarı" onClose={() => setForm(null)}>
          <form onSubmit={create}>
            {error && <div className="error">{error}</div>}
            <div className="grid">
              {!companyId && (
                <div>
                  <label>Firma *</label>
                  <select value={form.company} required onChange={e => setForm({ ...form, company: e.target.value })}>
                    <option value="">Seçin</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label>Uzatma süresi (gün) *</label>
                <input type="number" min="1" max="3650" value={form.days} required onChange={e => setForm({ ...form, days: e.target.value })} />
                <div className="row" style={{ marginTop: 8, marginBottom: 0 }}>
                  {[30, 90, 180, 365].map(d => (
                    <button key={d} type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, days: d })}>{d} gün</button>
                  ))}
                </div>
              </div>
              <div>
                <label>Anahtarın son kullanma tarihi (isteğe bağlı)</label>
                <input type="date" value={form.expires} onChange={e => setForm({ ...form, expires: e.target.value })} />
              </div>
              <div>
                <label>Not (isteğe bağlı)</label>
                <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Vazgeç</button>
              <button className="btn btn-primary">Anahtarı oluştur</button>
            </div>
          </form>
        </Modal>
      )}

      {created && (
        <Modal title="Anahtar oluşturuldu" onClose={() => setCreated(null)}>
          <p className="muted" style={{ marginTop: 0 }}>{created.company} firması için {created.days} günlük uzatma anahtarı:</p>
          <div className="key-box">{created.key}</div>
          <div className="banner" style={{ marginTop: 14 }}><Icon name="alert" /> Bu anahtar yalnızca şimdi gösterilir. Kapattıktan sonra tekrar görüntülenemez, kopyalayıp güvenli bir yerden iletin.</div>
          <div className="modal-foot">
            <button className="btn btn-ghost" onClick={copy}><Icon name="check" size={16} /> {copied ? 'Kopyalandı' : 'Kopyala'}</button>
            <button className="btn btn-primary" onClick={() => setCreated(null)}>Tamam</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
