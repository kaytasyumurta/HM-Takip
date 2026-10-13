'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/Icon'
import Modal from '@/components/Modal'
import { fmtNum, orderNo } from '@/lib/supply'

const pad = n => String(n).padStart(2, '0')
const toLocalInput = d => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}` }
const normPlate = s => (s || '').toUpperCase().replace(/\s+/g, '')
const REC_STATUS = { approved: ['active', 'Onaylı'], pending: ['soon', 'Beklemede'], cancelled: ['passive', 'İptal'] }
const fmtDT = d => new Date(d).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })

function rangeDates(range, from, to) {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  if (range === 'today') return [start, null]
  if (range === 'week') { start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); return [start, null] }
  if (range === 'month') { start.setDate(1); return [start, null] }
  if (range === 'custom') return [from ? new Date(from + 'T00:00:00') : null, to ? new Date(to + 'T23:59:59') : null]
  return [null, null]
}

function blankForm() {
  return { id: null, supply_order_id: '', plate: '', driver_name: '', weighed_at: toLocalInput(new Date()), gross_kg: '', tare_kg: '', moisture_pct: '', deduction_kg: '', freight_amount: '', status: 'approved', notes: '' }
}

export default function WeighbridgeManager({ companyId, companyName, userId, role }) {
  const supabase = useMemo(() => createClient(), [])
  const manager = ['company_admin', 'purchasing'].includes(role)
  const [rows, setRows] = useState([])
  const [orders, setOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [range, setRange] = useState('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [orderFilter, setOrderFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState({ key: 'weighed_at', dir: 'desc' })
  const [form, setForm] = useState(null)
  const [vehicle, setVehicle] = useState(null)
  const [ticket, setTicket] = useState(null)

  async function load() {
    let rq = supabase.from('weighbridge_records').select('*').eq('company_id', companyId).order('weighed_at', { ascending: false }).limit(1000)
    const [a, b] = rangeDates(range, from, to)
    if (a) rq = rq.gte('weighed_at', a.toISOString())
    if (b) rq = rq.lte('weighed_at', b.toISOString())
    const [r, o, s, p] = await Promise.all([
      rq,
      supabase.from('supply_orders').select('id, order_no, supplier_id, product_id, planned_qty, received_kg, status').eq('company_id', companyId).order('order_no', { ascending: false }),
      supabase.from('suppliers').select('id, name').eq('company_id', companyId),
      supabase.from('products').select('id, name').eq('company_id', companyId),
    ])
    if (r.error) setError(r.error.message); else setRows(r.data || [])
    setOrders(o.data || []); setSuppliers(s.data || []); setProducts(p.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [companyId, range, from, to])

  const sname = id => suppliers.find(s => s.id === id)?.name || '-'
  const pname = id => products.find(p => p.id === id)?.name || '-'
  const oref = id => orders.find(o => o.id === id)
  const remainingOf = o => Math.max(0, Number(o.planned_qty) - Number(o.received_kg) / 1000)
  const canEdit = r => manager || (r.created_by === userId && r.status === 'pending')

  // ---- form
  const so = form ? oref(form.supply_order_id) : null
  const net = form ? Number(form.gross_kg || 0) - Number(form.tare_kg || 0) : 0
  const existing = form?.id ? rows.find(r => r.id === form.id) : null
  const own = existing && existing.status === 'approved' && existing.supply_order_id === so?.id ? Number(existing.net_kg) / 1000 : 0
  const remainingTons = so ? Number(so.planned_qty) - Number(so.received_kg) / 1000 + own : 0
  const overBy = form && so && form.status === 'approved' && net > 0 ? net / 1000 - remainingTons : 0
  const tareDev = vehicle?.last_tare_kg && form?.tare_kg !== '' ? Math.abs(Number(form.tare_kg) - Number(vehicle.last_tare_kg)) / Number(vehicle.last_tare_kg) : 0
  const selectableOrders = orders.filter(o => ['active', 'partial'].includes(o.status) || o.id === form?.supply_order_id)

  async function lookupVehicle() {
    const p = normPlate(form.plate)
    if (!p) { setVehicle(null); return }
    const { data } = await supabase.from('vehicles').select('*').eq('company_id', companyId).eq('plate', p).maybeSingle()
    setVehicle(data || null)
    if (data) setForm(f => ({
      ...f,
      tare_kg: f.tare_kg === '' && data.last_tare_kg ? data.last_tare_kg : f.tare_kg,
      driver_name: f.driver_name === '' && data.driver_name ? data.driver_name : f.driver_name,
    }))
  }

  function openNew() { setError(''); setVehicle(null); setForm(blankForm()) }
  function openEdit(r) {
    setError(''); setVehicle(null)
    setForm({
      id: r.id, supply_order_id: r.supply_order_id, plate: r.plate, driver_name: r.driver_name || '', weighed_at: toLocalInput(r.weighed_at),
      gross_kg: r.gross_kg, tare_kg: r.tare_kg, moisture_pct: r.moisture_pct ?? '', deduction_kg: r.deduction_kg || '',
      freight_amount: r.freight_amount ?? '', status: r.status, notes: r.notes || '',
    })
  }

  async function save(e) {
    e.preventDefault(); setError('')
    if (!(Number(form.gross_kg) > Number(form.tare_kg))) { setError('Brüt ağırlık, dara ağırlığından büyük olmalı.'); return }
    const payload = {
      company_id: companyId, supply_order_id: form.supply_order_id, plate: normPlate(form.plate), driver_name: form.driver_name || null,
      weighed_at: new Date(form.weighed_at).toISOString(), gross_kg: Number(form.gross_kg), tare_kg: Number(form.tare_kg),
      moisture_pct: form.moisture_pct === '' ? null : Number(form.moisture_pct), deduction_kg: form.deduction_kg === '' ? 0 : Number(form.deduction_kg),
      freight_amount: form.freight_amount === '' ? null : Number(form.freight_amount), status: form.status, notes: form.notes || null,
    }
    const res = form.id
      ? await supabase.from('weighbridge_records').update(payload).eq('id', form.id)
      : await supabase.from('weighbridge_records').insert(payload)
    if (res.error) { setError(res.error.message); return }
    setForm(null); load()
  }

  async function setStatus(r, status) {
    setError('')
    const { error } = await supabase.from('weighbridge_records').update({ status }).eq('id', r.id)
    if (error) setError(error.message)
    load()
  }
  async function remove(r) {
    if (!confirm(`Fiş ${String(r.ticket_no).padStart(6, '0')} silinsin mi? Tedarik toplamı yeniden hesaplanır.`)) return
    const { error } = await supabase.from('weighbridge_records').delete().eq('id', r.id)
    if (error) setError(error.message)
    load()
  }

  // ---- liste
  const needle = q.toLocaleLowerCase('tr-TR')
  const filtered = rows.filter(r =>
    (!needle || `${r.plate} ${r.driver_name || ''} ${r.ticket_no} ${sname(r.supplier_id)}`.toLocaleLowerCase('tr-TR').includes(needle)) &&
    (!orderFilter || r.supply_order_id === orderFilter) && (!statusFilter || r.status === statusFilter))
  const sorted = [...filtered].sort((a, b) => {
    const av = sort.key === 'net_kg' ? Number(a.net_kg) : new Date(a.weighed_at).getTime()
    const bv = sort.key === 'net_kg' ? Number(b.net_kg) : new Date(b.weighed_at).getTime()
    return sort.dir === 'asc' ? av - bv : bv - av
  })
  const approved = filtered.filter(r => r.status === 'approved')
  const totalNet = approved.reduce((t, r) => t + Number(r.net_kg), 0)
  const toggleSort = key => setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))
  const arrow = key => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')

  function exportCsv() {
    const num = n => (n === null || n === undefined ? '' : String(n).replace('.', ','))
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = ['Fiş No', 'Tarih', 'Saat', 'Tedarikçi', 'Ürün', 'Plaka', 'Şoför', 'Brüt (kg)', 'Dara (kg)', 'Net (kg)', 'Nem %', 'Kesinti (kg)', 'Nakliye (TL)', 'Tedarik No', 'Durum']
    const lines = sorted.map(r => {
      const d = new Date(r.weighed_at)
      return [r.ticket_no, d.toLocaleDateString('tr-TR'), d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), sname(r.supplier_id), pname(r.product_id), r.plate, r.driver_name || '',
        num(r.gross_kg), num(r.tare_kg), num(r.net_kg), num(r.moisture_pct), num(r.deduction_kg), num(r.freight_amount), orderNo(oref(r.supply_order_id)?.order_no || 0), REC_STATUS[r.status][1]].map(esc).join(';')
    })
    const blob = new Blob(['\ufeff' + [head.map(esc).join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `kantar-kayitlari-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-icon"><Icon name="truck" size={24} /></div><div><div className="stat-label">Onaylı araç</div><div className="stat-value">{approved.length}</div></div></div>
        <div className="stat-card"><div className="stat-icon"><Icon name="scale" size={24} /></div><div><div className="stat-label">Toplam net tonaj</div><div className="stat-value">{fmtNum(totalNet / 1000, 3)} <span style={{ fontSize: 14 }}>ton</span></div></div></div>
        <div className="stat-card"><div className="stat-icon"><Icon name="clock" size={24} /></div><div><div className="stat-label">Beklemede</div><div className="stat-value">{filtered.filter(r => r.status === 'pending').length}</div></div></div>
        <div className="stat-card"><div className="stat-icon"><Icon name="alert" size={24} /></div><div><div className="stat-label">Dara uyarısı</div><div className="stat-value">{filtered.filter(r => r.tare_alert && r.status !== 'cancelled').length}</div></div></div>
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder="Plaka, şoför, fiş no veya tedarikçi..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={exportCsv}><Icon name="download" size={16} /> Excel'e aktar</button>
        <button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={18} /> Yeni Araç Kaydı Ekle</button>
      </div>

      <div className="filter-row" style={{ marginTop: -6 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {[['today', 'Bugün'], ['week', 'Bu hafta'], ['month', 'Bu ay'], ['all', 'Tümü'], ['custom', 'Tarih aralığı']].map(([v, l]) => (
            <button key={v} className={`tab ${range === v ? 'on' : ''}`} onClick={() => setRange(v)}>{l}</button>
          ))}
        </div>
        {range === 'custom' && (
          <>
            <div><label>Başlangıç</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><label>Bitiş</label><input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          </>
        )}
        <div style={{ minWidth: 220 }}>
          <label>Tedarik</label>
          <select value={orderFilter} onChange={e => setOrderFilter(e.target.value)}>
            <option value="">Tümü</option>
            {orders.map(o => <option key={o.id} value={o.id}>{orderNo(o.order_no)} · {sname(o.supplier_id)} · {pname(o.product_id)}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 160 }}>
          <label>Durum</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Tümü</option>
            {Object.entries(REC_STATUS).map(([v, [, l]]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {error && !form && <div className="error">{error}</div>}

      <div className="table-card">
        <div className="table-wrap">
          {loading ? <div className="empty">Yükleniyor...</div> : (
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('weighed_at')}>TARİH / SAAT{arrow('weighed_at')}</th>
                  <th>FİŞ</th><th>FİRMA</th><th>ÜRÜN</th><th>PLAKA</th><th>ŞOFÖR</th><th>BRÜT</th><th>DARA</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('net_kg')}>NET (TON){arrow('net_kg')}</th>
                  <th>NAKLİYE</th><th>BAĞLI TEDARİK</th><th>DURUM</th><th>İŞLEMLER</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r.id} style={r.status === 'cancelled' ? { opacity: .55 } : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDT(r.weighed_at)}</td>
                    <td>{String(r.ticket_no).padStart(6, '0')}</td>
                    <td>{sname(r.supplier_id)}</td>
                    <td>{pname(r.product_id)}</td>
                    <td className="td-strong" style={{ whiteSpace: 'nowrap' }}>
                      {r.plate}{r.tare_alert && <span className="status soon" style={{ marginLeft: 8, padding: '2px 8px' }} title="Dara, aracın kayıtlı daralarından %5'ten fazla farklı"><i />Dara!</span>}
                    </td>
                    <td>{r.driver_name || '-'}</td>
                    <td>{fmtNum(r.gross_kg, 0)} kg</td>
                    <td>{fmtNum(r.tare_kg, 0)} kg</td>
                    <td className="td-strong">{fmtNum(Number(r.net_kg) / 1000, 3)}</td>
                    <td>{r.freight_amount != null ? `${fmtNum(r.freight_amount, 2)} TL` : '-'}</td>
                    <td>{orderNo(oref(r.supply_order_id)?.order_no || 0)}</td>
                    <td><span className={`status ${REC_STATUS[r.status][0]}`}><i />{REC_STATUS[r.status][1]}</span></td>
                    <td>
                      <div className="td-actions">
                        <button className="btn btn-blue btn-sm" onClick={() => setTicket(r)}><Icon name="printer" size={15} /> Fiş</button>
                        {canEdit(r) && <button className="btn btn-violet btn-sm" onClick={() => openEdit(r)}><Icon name="pencil" size={15} /> Düzenle</button>}
                        {canEdit(r) && r.status === 'pending' && <button className="btn btn-green btn-sm" onClick={() => setStatus(r, 'approved')}><Icon name="check" size={15} /> Onayla</button>}
                        {manager && r.status !== 'cancelled' && <button className="btn btn-red btn-sm" onClick={() => setStatus(r, 'cancelled')}><Icon name="ban" size={15} /> İptal</button>}
                        {manager && <button className="btn btn-red btn-sm" onClick={() => remove(r)}><Icon name="trash" size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!sorted.length && <tr><td colSpan={13} className="empty">Bu aralıkta kantar kaydı yok.</td></tr>}
              </tbody>
              {!!sorted.length && (
                <tfoot>
                  <tr><td colSpan={8} style={{ padding: '14px 18px', fontWeight: 700 }}>Toplam (yalnızca onaylı kayıtlar)</td><td className="td-strong" style={{ padding: '14px 18px' }}>{fmtNum(totalNet / 1000, 3)}</td><td colSpan={4} /></tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>

      {form && (
        <Modal title={form.id ? 'Araç kaydını düzenle' : 'Yeni araç kaydı'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            {error && <div className="error">{error}</div>}
            <div className="grid">
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Bağlı tedarik *</label>
                <select value={form.supply_order_id} required onChange={e => setForm({ ...form, supply_order_id: e.target.value })}>
                  <option value="">Aktif tedarik seçin</option>
                  {selectableOrders.map(o => <option key={o.id} value={o.id}>{orderNo(o.order_no)} · {sname(o.supplier_id)} · {pname(o.product_id)} · kalan {fmtNum(remainingOf(o), 3)} ton</option>)}
                </select>
                {!selectableOrders.length && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Aktif tedarik yok. Önce Hammadde Tedarik sayfasından bir tedarik oluşturun.</div>}
              </div>
              <div>
                <label>Plaka *</label>
                <input value={form.plate} required placeholder="38 AB 123" onChange={e => setForm({ ...form, plate: e.target.value })} onBlur={lookupVehicle} />
                {vehicle?.last_tare_kg && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Kayıtlı dara: {fmtNum(vehicle.last_tare_kg, 0)} kg</div>}
              </div>
              <div><label>Şoför adı</label><input value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} /></div>
              <div><label>Brüt ağırlık (kg) *</label><input type="number" step="any" min="0" value={form.gross_kg} required onChange={e => setForm({ ...form, gross_kg: e.target.value })} /></div>
              <div><label>Dara ağırlığı (kg) *</label><input type="number" step="any" min="0" value={form.tare_kg} required onChange={e => setForm({ ...form, tare_kg: e.target.value })} /></div>
            </div>

            <div className="card" style={{ margin: '16px 0 0', textAlign: 'center' }}>
              <div className="stat-label">Net tonaj (brüt − dara)</div>
              <div className="stat-value" style={{ color: net > 0 ? 'var(--primary-text)' : 'var(--muted)' }}>
                {net > 0 ? `${fmtNum(net, 0)} kg · ${fmtNum(net / 1000, 3)} ton` : '-'}
              </div>
              {so && net > 0 && <div className="muted" style={{ fontSize: 13 }}>Tedarikte kalan: {fmtNum(remainingTons, 3)} ton → bu kayıttan sonra {fmtNum(Math.max(0, remainingTons - net / 1000), 3)} ton</div>}
            </div>
            {overBy > 0 && <div className="banner danger" style={{ marginTop: 12, marginBottom: 0 }}><Icon name="alert" /> Bu kayıt tedarikin kalan miktarını {fmtNum(overBy, 3)} ton aşıyor. Kaydedilirse fazla teslimat olarak işaretlenir.</div>}
            {tareDev > 0.05 && <div className="banner" style={{ marginTop: 12, marginBottom: 0 }}><Icon name="alert" /> Dara, aracın kayıtlı daralarından %{Math.round(tareDev * 100)} farklı. Lütfen kontrol edin.</div>}

            <div className="grid" style={{ marginTop: 16 }}>
              <div><label>Tartım tarihi ve saati *</label><input type="datetime-local" value={form.weighed_at} required onChange={e => setForm({ ...form, weighed_at: e.target.value })} /></div>
              <div><label>Nem (%)</label><input type="number" step="any" min="0" max="100" value={form.moisture_pct} onChange={e => setForm({ ...form, moisture_pct: e.target.value })} /></div>
              <div><label>Kesinti (kg)</label><input type="number" step="any" min="0" value={form.deduction_kg} onChange={e => setForm({ ...form, deduction_kg: e.target.value })} /></div>
              <div><label>Nakliye bedeli (TL)</label><input type="number" step="any" min="0" value={form.freight_amount} onChange={e => setForm({ ...form, freight_amount: e.target.value })} /></div>
              <div>
                <label>Kayıt durumu</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="approved">Onaylı (tonaja eklenir)</option>
                  <option value="pending">Beklemede (tonaja eklenmez)</option>
                  {form.id && manager && <option value="cancelled">İptal</option>}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}><label>Açıklama</label><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Vazgeç</button>
              <button className="btn btn-primary">Kaydet</button>
            </div>
          </form>
        </Modal>
      )}

      {ticket && (() => {
        const o = oref(ticket.supply_order_id)
        const payable = Number(ticket.net_kg) - Number(ticket.deduction_kg || 0)
        return (
          <Modal title="Kantar fişi" onClose={() => setTicket(null)}>
            <div className="ticket-print">
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{companyName}</div>
                <div className="muted">KANTAR FİŞİ · No: {String(ticket.ticket_no).padStart(6, '0')}</div>
              </div>
              <div className="kv">
                <span>Tartım zamanı</span><strong>{fmtDT(ticket.weighed_at)}</strong>
                <span>Tedarikçi</span><strong>{sname(ticket.supplier_id)}</strong>
                <span>Ürün</span><strong>{pname(ticket.product_id)}</strong>
                <span>Bağlı tedarik</span><strong>{orderNo(o?.order_no || 0)}</strong>
                <span>Plaka</span><strong>{ticket.plate}</strong>
                <span>Şoför</span><strong>{ticket.driver_name || '-'}</strong>
                <span>Brüt</span><strong>{fmtNum(ticket.gross_kg, 0)} kg</strong>
                <span>Dara</span><strong>{fmtNum(ticket.tare_kg, 0)} kg</strong>
                <span>Net</span><strong>{fmtNum(ticket.net_kg, 0)} kg ({fmtNum(Number(ticket.net_kg) / 1000, 3)} ton)</strong>
                {ticket.moisture_pct != null && (<><span>Nem</span><strong>%{fmtNum(ticket.moisture_pct, 2)}</strong></>)}
                {Number(ticket.deduction_kg) > 0 && (<><span>Kesinti</span><strong>{fmtNum(ticket.deduction_kg, 0)} kg</strong><span>Kesinti sonrası</span><strong>{fmtNum(payable, 0)} kg</strong></>)}
                <span>Durum</span><strong>{REC_STATUS[ticket.status][1]}</strong>
                {ticket.notes && (<><span>Not</span><strong>{ticket.notes}</strong></>)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 36, fontSize: 13 }}>
                <span>Kantar sorumlusu: ______________</span><span>Şoför imzası: ______________</span>
              </div>
            </div>
            <div className="modal-foot no-print">
              <button className="btn btn-ghost" onClick={() => setTicket(null)}>Kapat</button>
              <button className="btn btn-primary" onClick={() => window.print()}><Icon name="printer" size={16} /> Yazdır</button>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
