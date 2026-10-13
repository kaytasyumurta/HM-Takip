'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_TR } from '@/lib/format'

export default function MembersManager({ companyId, selfId }) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('weighbridge')
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

  return (
    <div>
      <form className="card" onSubmit={add}>
        <div className="grid">
          <div>
            <label>Kullanıcının e-postası (önce hesap oluşturmuş olmalı)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Rol</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              {Object.entries(ROLE_TR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}><button>Firmaya Ekle</button></div>
      </form>
      {error && <div className="error">{error}</div>}
      {info && <div className="muted" style={{ marginBottom: 8 }}>{info}</div>}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Ad Soyad</th><th>E-posta</th><th>Rol</th><th>Aktif</th><th></th></tr></thead>
          <tbody>
            {rows.map(r => {
              const self = r.user_id === selfId
              return (
                <tr key={r.id}>
                  <td>{r.profile?.full_name}</td>
                  <td>{r.profile?.email}</td>
                  <td>
                    <select value={r.role} disabled={self} onChange={e => update(r.id, { role: e.target.value })}>
                      {Object.entries(ROLE_TR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td><input type="checkbox" checked={r.active} disabled={self} onChange={e => update(r.id, { active: e.target.checked })} /></td>
                  <td>{!self && <button className="danger" onClick={() => remove(r.id)}>Çıkar</button>}</td>
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={5} className="muted">Henüz kullanıcı yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
