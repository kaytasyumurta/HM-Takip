'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_TR } from '@/lib/format'
import Icon from '@/components/Icon'

export default function JoinRequests({ companyId, onChanged }) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState([])
  const [roles, setRoles] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)

  async function load() {
    const { data, error } = await supabase
      .from('join_requests')
      .select('id, requested_at, profile:profiles(full_name, email)')
      .eq('company_id', companyId).eq('status', 'pending')
      .order('requested_at', { ascending: true })
    if (error) setError(error.message); else setRows(data || [])
  }
  useEffect(() => { load() }, [companyId])

  async function decide(id, approve) {
    setError(''); setBusy(id)
    const { data, error } = await supabase.rpc('decide_join_request', {
      p_request: id, p_approve: approve, p_role: approve ? (roles[id] || 'purchasing') : null,
    })
    if (error) setError(error.message)
    else if (!data?.ok) setError(data?.error || 'İşlem başarısız.')
    else { await load(); onChanged && onChanged() }
    setBusy(null)
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        <strong>Bekleyen başvurular</strong>
        <span className={`status ${rows.length ? 'soon' : 'draft'}`}><i />{rows.length}</span>
      </div>
      {error && <div className="error">{error}</div>}
      {!rows.length ? (
        <p className="muted" style={{ margin: 0 }}>Bekleyen başvuru yok. Firma kodunuzla kayıt olan kişiler burada görünür.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>AD SOYAD</th><th>E-POSTA</th><th>BAŞVURU TARİHİ</th><th>VERİLECEK ROL</th><th>İŞLEMLER</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="td-strong">{r.profile?.full_name || '-'}</td>
                  <td>{r.profile?.email || '-'}</td>
                  <td>{new Date(r.requested_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>
                    <select className="sm" value={roles[r.id] || 'purchasing'} onChange={e => setRoles({ ...roles, [r.id]: e.target.value })}>
                      {Object.entries(ROLE_TR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="td-actions">
                      <button className="btn btn-green btn-sm" disabled={busy === r.id} onClick={() => decide(r.id, true)}><Icon name="check" size={15} /> Onayla</button>
                      <button className="btn btn-red btn-sm" disabled={busy === r.id} onClick={() => decide(r.id, false)}><Icon name="ban" size={15} /> Reddet</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
