'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate, ROLE_TR } from '@/lib/format'

const TYPE_TR = {
  company_created: 'Firma oluşturuldu',
  manual_change: 'Lisans elle değiştirildi',
  extended: 'Lisans uzatıldı',
  activation_used: 'Aktivasyon kodu kullanıldı',
  key_created: 'Anahtar oluşturuldu',
  key_revoked: 'Anahtar iptal edildi',
  failed_attempt: 'Hatalı anahtar denemesi',
}
const COMPANY_VISIBLE = ['company_created', 'manual_change', 'extended', 'activation_used']

function detailText(e) {
  const d = e.details || {}
  const parts = []
  if (e.old_end && e.new_end) parts.push(`${fmtDate(e.old_end)} → ${fmtDate(e.new_end)}`)
  else if (e.new_end) parts.push(`Bitiş: ${fmtDate(e.new_end)}`)
  if (d.days) parts.push(`${d.days} gün`)
  if (d.kind) parts.push(d.kind === 'extension' ? 'uzatma' : 'aktivasyon')
  if (d.role) parts.push(ROLE_TR[d.role] || d.role)
  if (d.old_status && d.new_status && d.old_status !== d.new_status) parts.push(`durum: ${d.old_status === 'active' ? 'aktif' : 'pasif'} → ${d.new_status === 'active' ? 'aktif' : 'pasif'}`)
  if (d.hint) parts.push(`anahtar …${d.hint}`)
  return parts.join(' · ')
}

export default function LicenseHistory({ companyId, showCompany = false, companyView = false }) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState([])
  const [companies, setCompanies] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      let q = supabase.from('license_events')
        .select('*, profile:profiles(full_name, email)')
        .order('created_at', { ascending: false }).limit(200)
      if (companyId) q = q.eq('company_id', companyId)
      if (companyView) q = q.in('event_type', COMPANY_VISIBLE)
      const [ev, co] = await Promise.all([q, showCompany ? supabase.from('companies').select('id, name') : Promise.resolve({ data: [] })])
      if (ev.error) setError(ev.error.message); else setRows(ev.data || [])
      setCompanies(co.data || [])
    }
    load()
  }, [companyId, showCompany, companyView])

  const cname = id => companies.find(c => c.id === id)?.name || '-'

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <div className="table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>TARİH</th>{showCompany && <th>FİRMA</th>}<th>İŞLEM</th><th>KULLANICI</th><th>DETAY</th></tr>
            </thead>
            <tbody>
              {rows.map(e => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  {showCompany && <td className="td-strong">{cname(e.company_id)}</td>}
                  <td>{TYPE_TR[e.event_type] || e.event_type}</td>
                  <td>{e.profile?.full_name || e.profile?.email || '-'}</td>
                  <td className="muted">{detailText(e)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={showCompany ? 5 : 4} className="empty">Henüz kayıt yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
