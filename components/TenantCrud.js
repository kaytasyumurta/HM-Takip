'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/Icon'
import Modal from '@/components/Modal'

function friendly(error) {
  if (error.code === '23503') return 'Bu kayıt tedarik emirlerinde kullanıldığı için silinemez. Bunun yerine pasife alabilirsiniz.'
  if (error.code === '23505') return 'Bu isimde bir kayıt zaten var.'
  return error.message
}

export default function TenantCrud({ table, companyId, canManage, fields, columns, newLabel }) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data, error } = await supabase.from(table).select('*').eq('company_id', companyId).order('created_at', { ascending: false })
    if (error) setError(error.message); else setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [companyId])

  function blank() {
    const f = {}
    fields.forEach(x => { f[x.key] = x.type === 'checkbox' ? (x.default ?? true) : (x.default ?? '') })
    return f
  }
  function edit(r) {
    const f = { id: r.id }
    fields.forEach(x => { f[x.key] = r[x.key] ?? (x.type === 'checkbox' ? false : '') })
    setError(''); setForm(f)
  }

  async function save(e) {
    e.preventDefault(); setError('')
    const payload = {}
    fields.forEach(x => {
      let v = form[x.key]
      if (x.type !== 'checkbox' && v === '') v = null
      payload[x.key] = v
    })
    const res = form.id
      ? await supabase.from(table).update(payload).eq('id', form.id)
      : await supabase.from(table).insert({ ...payload, company_id: companyId })
    if (res.error) { setError(friendly(res.error)); return }
    setForm(null); load()
  }

  async function remove(id) {
    if (!confirm('Bu kayıt silinsin mi?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) setError(friendly(error)); else load()
  }

  const needle = q.toLocaleLowerCase('tr-TR')
  const shown = rows.filter(r => !needle || JSON.stringify(Object.values(r)).toLocaleLowerCase('tr-TR').includes(needle))

  return (
    <div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder="Ara..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={() => setQ('')}><Icon name="refresh" size={16} /> Sıfırla</button>
        {canManage && <button className="btn btn-primary" onClick={() => { setError(''); setForm(blank()) }}><Icon name="plus" size={18} /> {newLabel}</button>}
      </div>
      {error && !form && <div className="error">{error}</div>}

      <div className="table-card">
        <div className="table-wrap">
          {loading ? <div className="empty">Yükleniyor...</div> : (
            <table>
              <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}{canManage && <th>İŞLEMLER</th>}</tr></thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.id}>
                    {columns.map(c => (
                      <td key={c.key} className={c.strong ? 'td-strong' : ''}>
                        {c.type === 'bool' ? <span className={`status ${r[c.key] ? 'active' : 'passive'}`}><i />{r[c.key] ? 'Aktif' : 'Pasif'}</span> : (r[c.key] ?? '-')}
                      </td>
                    ))}
                    {canManage && (
                      <td>
                        <div className="td-actions">
                          <button className="btn btn-violet btn-sm" onClick={() => edit(r)}><Icon name="pencil" size={15} /> Düzenle</button>
                          <button className="btn btn-red btn-sm" onClick={() => remove(r.id)}><Icon name="trash" size={15} /> Sil</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={columns.length + 1} className="empty">Kayıt yok.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {form && (
        <Modal title={form.id ? 'Kaydı düzenle' : newLabel} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            {error && <div className="error">{error}</div>}
            <div className="grid">
              {fields.map(x => (
                <div key={x.key} style={x.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
                  <label>{x.label}{x.required ? ' *' : ''}</label>
                  {x.type === 'select' ? (
                    <select value={form[x.key]} required={x.required} onChange={e => setForm({ ...form, [x.key]: e.target.value })}>
                      {x.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : x.type === 'textarea' ? (
                    <textarea rows={2} value={form[x.key]} onChange={e => setForm({ ...form, [x.key]: e.target.value })} />
                  ) : x.type === 'checkbox' ? (
                    <input type="checkbox" checked={!!form[x.key]} onChange={e => setForm({ ...form, [x.key]: e.target.checked })} />
                  ) : (
                    <input value={form[x.key]} required={x.required} onChange={e => setForm({ ...form, [x.key]: e.target.value })} />
                  )}
                </div>
              ))}
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
