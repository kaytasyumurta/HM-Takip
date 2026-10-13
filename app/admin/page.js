'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { daysLeft, fmtDate, licenseState, LICENSE_TR } from '@/lib/format'

function toDateInput(d) {
  const x = new Date(d)
  const p = n => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const { data, error } = await supabase
      .from('companies').select('*, memberships(count)').order('created_at', { ascending: false })
    if (error) setError(error.message); else setRows(data || [])
  }
  useEffect(() => { load() }, [])

  function newForm() { setForm({ name: '', code: '', contact_info: '', days: 30 }) }
  function editForm(c) {
    setForm({ id: c.id, name: c.name, code: c.code, contact_info: c.contact_info || '', status: c.status, license_end: toDateInput(c.license_end) })
  }

  async function save(e) {
    e.preventDefault(); setError('')
    let res
    if (form.id) {
      const end = new Date(form.license_end + 'T23:59:59')
      res = await supabase.from('companies').update({
        name: form.name, code: form.code.trim().toUpperCase(), contact_info: form.contact_info || null,
        status: form.status, license_end: end.toISOString(),
      }).eq('id', form.id)
    } else {
      const start = new Date()
      const end = new Date(start.getTime() + Number(form.days) * 86400000)
      res = await supabase.from('companies').insert({
        name: form.name, code: form.code.trim().toUpperCase(), contact_info: form.contact_info || null,
        license_start: start.toISOString(), license_end: end.toISOString(),
      })
    }
    if (res.error) {
      setError(res.error.message.includes('companies_code_uidx') ? 'Bu firma kodu zaten kullanılıyor.' : res.error.message)
      return
    }
    setForm(null); load()
  }

  return (
    <div>
      <h1>Firmalar ve Lisanslar</h1>
      <div className="row"><button onClick={() => { setError(''); newForm() }}>+ Yeni Firma</button></div>
      {error && <div className="error">{error}</div>}

      {form && (
        <form className="card" onSubmit={save}>
          <div className="grid">
            <div><label>Firma Adı *</label><input value={form.name} required onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Firma Kodu * (girişte kullanılır)</label><input value={form.code} required onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div><label>İletişim / Notlar</label><input value={form.contact_info} onChange={e => setForm({ ...form, contact_info: e.target.value })} /></div>
            {form.id ? (
              <>
                <div><label>Durum</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Aktif</option><option value="passive">Pasif (erişim kapalı)</option>
                  </select>
                </div>
                <div><label>Lisans Bitiş Tarihi</label><input type="date" value={form.license_end} required onChange={e => setForm({ ...form, license_end: e.target.value })} /></div>
              </>
            ) : (
              <div><label>Lisans Süresi (gün)</label><input type="number" min="1" value={form.days} required onChange={e => setForm({ ...form, days: e.target.value })} /></div>
            )}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button>Kaydet</button>
            <button type="button" className="ghost" onClick={() => setForm(null)}>Vazgeç</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Firma</th><th>Kod</th><th>Lisans</th><th>Bitiş</th><th>Kalan</th><th>Kullanıcı</th><th></th></tr></thead>
          <tbody>
            {rows.map(c => {
              const st = licenseState(c)
              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.code}</td>
                  <td><span className={`badge ${st}`}>{LICENSE_TR[st]}</span></td>
                  <td>{fmtDate(c.license_end)}</td>
                  <td>{daysLeft(c.license_end)} gün</td>
                  <td>{c.memberships?.[0]?.count ?? 0}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Link href={`/admin/${c.id}`}><button className="ghost">Kullanıcılar</button></Link>{' '}
                    <button className="ghost" onClick={() => { setError(''); editForm(c) }}>Düzenle</button>
                  </td>
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={7} className="muted">Henüz firma yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
