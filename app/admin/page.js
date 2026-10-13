'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { daysLeft, fmtDate, licenseState, LICENSE_TR } from '@/lib/format'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'
import Icon from '@/components/Icon'

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
  const [q, setQ] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  async function load() {
    const { data, error } = await supabase
      .from('companies').select('*, memberships(count)').order('created_at', { ascending: false })
    if (error) setError(error.message); else setRows(data || [])
  }
  useEffect(() => { load() }, [])

  function newForm() { setError(''); setForm({ name: '', code: '', contact_info: '', days: 30 }) }
  function editForm(c) {
    setError('')
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

  async function toggleStatus(c) {
    const toPassive = c.status === 'active'
    if (!confirm(toPassive ? `${c.name} firmasının erişimi kapatılsın mı?` : `${c.name} firmasının erişimi açılsın mı?`)) return
    const { error } = await supabase.from('companies').update({ status: toPassive ? 'passive' : 'active' }).eq('id', c.id)
    if (error) setError(error.message)
    load()
  }

  const needle = q.toLocaleLowerCase('tr-TR')
  const shown = rows.filter(c =>
    (!needle || `${c.name} ${c.code}`.toLocaleLowerCase('tr-TR').includes(needle)) &&
    (!statusFilter || licenseState(c) === statusFilter))

  return (
    <div>
      <PageHeader icon="building" title="Firma Yönetimi" subtitle="Firmaları, lisans sürelerini ve kullanıcıları yönetin.">
        <button className="btn btn-primary" onClick={newForm}><Icon name="plus" size={18} /> Yeni Firma</button>
      </PageHeader>

      {error && !form && <div className="error">{error}</div>}

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder="Firma adı veya kodu..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={() => setShowFilter(s => !s)}><Icon name="filter" size={16} /> Filtrele</button>
        <button className="btn btn-ghost" onClick={() => { setQ(''); setStatusFilter(''); setShowFilter(false) }}><Icon name="refresh" size={16} /> Sıfırla</button>
      </div>
      {showFilter && (
        <div className="filter-row">
          <div style={{ minWidth: 220 }}>
            <label>Lisans durumu</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Tümü</option>
              <option value="active">Aktif</option>
              <option value="soon">Süresi yaklaşıyor</option>
              <option value="expired">Süresi doldu</option>
              <option value="passive">Pasif</option>
            </select>
          </div>
        </div>
      )}

      <div className="table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>FİRMA ADI</th><th>KOD</th><th>LİSANS</th><th>BİTİŞ TARİHİ</th><th>KALAN</th><th>KULLANICI</th><th>İŞLEMLER</th></tr>
            </thead>
            <tbody>
              {shown.map(c => {
                const st = licenseState(c)
                return (
                  <tr key={c.id}>
                    <td className="td-strong">{c.name}</td>
                    <td>{c.code}</td>
                    <td><span className={`status ${st}`}><i />{LICENSE_TR[st]}</span></td>
                    <td>{fmtDate(c.license_end)}</td>
                    <td>{daysLeft(c.license_end)} gün</td>
                    <td>{c.memberships?.[0]?.count ?? 0}</td>
                    <td>
                      <div className="td-actions">
                        <Link href={`/admin/${c.id}`} className="btn btn-blue btn-sm"><Icon name="eye" size={15} /> Detay</Link>
                        <button className="btn btn-violet btn-sm" onClick={() => editForm(c)}><Icon name="pencil" size={15} /> Düzenle</button>
                        <button className={`btn btn-sm ${c.status === 'active' ? 'btn-red' : 'btn-green'}`} onClick={() => toggleStatus(c)}>
                          <Icon name={c.status === 'active' ? 'ban' : 'check'} size={15} /> {c.status === 'active' ? 'Pasife al' : 'Aktif et'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!shown.length && <tr><td colSpan={7} className="empty">Henüz firma yok. Yeni Firma ile ilk firmayı oluşturun.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title={form.id ? 'Firmayı düzenle' : 'Yeni firma'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            {error && <div className="error">{error}</div>}
            <div className="grid">
              <div><label>Firma adı *</label><input value={form.name} required onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><label>Firma kodu * (girişte kullanılır)</label><input value={form.code} required onChange={e => setForm({ ...form, code: e.target.value })} /></div>
              <div><label>İletişim / notlar</label><input value={form.contact_info} onChange={e => setForm({ ...form, contact_info: e.target.value })} /></div>
              {form.id ? (
                <>
                  <div><label>Durum</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option value="active">Aktif</option><option value="passive">Pasif (erişim kapalı)</option>
                    </select>
                  </div>
                  <div><label>Lisans bitiş tarihi</label><input type="date" value={form.license_end} required onChange={e => setForm({ ...form, license_end: e.target.value })} /></div>
                </>
              ) : (
                <div><label>Lisans süresi (gün)</label><input type="number" min="1" value={form.days} required onChange={e => setForm({ ...form, days: e.target.value })} /></div>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Vazgeç</button>
              <button className="btn btn-primary">Kaydet</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
