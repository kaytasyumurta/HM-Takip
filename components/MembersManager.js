'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_TR } from '@/lib/format'
import Icon from '@/components/Icon'

export default function MembersManager({ companyId, selfId }) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('weighbridge')
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function load() {
    const { data, error } = await supabase
      .from('memberships')
      .select('id, role, active, user_id, profile:profiles(full_name, email)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
    if (error) setError(error.message); else setRows(data || [])
  }
  useEffect(() => { load() }, [companyId])

  async function add(e) {
    e.preventDefault(); setError(''); setInfo('')
    const { error } = await supabase.rpc('add_member_by_email', { p_company: companyId, p_email: email, p_role: role })
    if (error) setError(error.message)
    else { setInfo('Kullanıcı firmaya eklendi.'); setEmail(''); load() }
  }
  async function update(id, patch) {
    setError(''); setInfo('')
    const { error } = await supabase.from('memberships').update(patch).eq('id', id)
    if (error) setError(error.message)
    load()
  }
  async function remove(id) {
    if (!confirm('Bu kullanıcı firmadan çıkarılsın mı?')) return
    const { error } = await supabase.from('memberships').delete().eq('id', id)
    if (error) setError(error.message)
    load()
  }

  const needle = q.toLocaleLowerCase('tr-TR')
  const shown = rows.filter(r => !needle || `${r.profile?.full_name || ''} ${r.profile?.email || ''}`.toLocaleLowerCase('tr-TR').includes(needle))

  return (
    <div>
      <form className="card" onSubmit={add}>
        <div className="grid">
          <div>
            <label>Kullanıcının e-postası (önce hesap oluşturmuş olmalı)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@firma.com" required />
          </div>
          <div>
            <label>Rol</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              {Object.entries(ROLE_TR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 16 }}><button className="btn btn-primary"><Icon name="userplus" size={16} /> Firmaya ekle</button></div>
      </form>

      {error && <div className="error">{error}</div>}
      {info && <div className="notice">{info}</div>}

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder="Ad veya e-posta ara..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setQ('')}><Icon name="refresh" size={16} /> Sıfırla</button>
      </div>

      <div className="table-card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>AD SOYAD</th><th>E-POSTA</th><th>ROL</th><th>AKTİF</th><th>İŞLEMLER</th></tr></thead>
            <tbody>
              {shown.map(r => {
                const self = r.user_id === selfId
                return (
                  <tr key={r.id}>
                    <td className="td-strong">{r.profile?.full_name || '-'}</td>
                    <td>{r.profile?.email}</td>
                    <td>
                      <select className="sm" value={r.role} disabled={self} onChange={e => update(r.id, { role: e.target.value })}>
                        {Object.entries(ROLE_TR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td><input type="checkbox" checked={r.active} disabled={self} onChange={e => update(r.id, { active: e.target.checked })} /></td>
                    <td>{!self && <button className="btn btn-red btn-sm" onClick={() => remove(r.id)}><Icon name="trash" size={15} /> Çıkar</button>}</td>
                  </tr>
                )
              })}
              {!shown.length && <tr><td colSpan={5} className="empty">Kullanıcı bulunamadı.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
