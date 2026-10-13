'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/format'
import Icon from '@/components/Icon'
import Modal from '@/components/Modal'
import ProgressBar from '@/components/ProgressBar'
import {
  STATUS_TR, STATUS_CLS, FREIGHT_MODEL_TR, FREIGHT_BASIS_TR,
  fmtNum, fmtTRY, orderNo, priceText, freightText, calcCosts, progress,
} from '@/lib/supply'

const today = () => new Date().toISOString().slice(0, 10)

function blankForm() {
  return {
    id: null, supplier_id: '', product_id: '', planned_qty: '', unit_price: '', price_unit: 'TL/ton',
    vat_rate: 20, vat_included: 'false', freight_model: 'separate', freight_basis: 'per_vehicle', freight_price: '',
    freight_vat_rate: 20, freight_vat_included: 'false', start_date: today(), planned_end_date: '', status: 'active', notes: '',
  }
}

export default function SupplyManager({ companyId, canManage }) {
  const supabase = useMemo(() => createClient(), [])
  const [orders, setOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [onlyUnknown, setOnlyUnknown] = useState(false)
  const [form, setForm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [history, setHistory] = useState([])
  const [quick, setQuick] = useState(null)

  async function load() {
    const [o, s, p] = await Promise.all([
      supabase.from('supply_orders').select('*').eq('company_id', companyId).order('order_no', { ascending: false }),
      supabase.from('suppliers').select('id, name, active').eq('company_id', companyId).order('name'),
      supabase.from('products').select('id, name, active').eq('company_id', companyId).order('name'),
    ])
    if (o.error) setError(o.error.message); else setOrders(o.data || [])
    setSuppliers(s.data || []); setProducts(p.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [companyId])

  const sname = id => suppliers.find(s => s.id === id)?.name || '-'
  const pname = id => products.find(p => p.id === id)?.name || '-'

  function editForm(o) {
    setError('')
    setForm({
      id: o.id, supplier_id: o.supplier_id, product_id: o.product_id, planned_qty: o.planned_qty, unit_price: o.unit_price,
      price_unit: o.price_unit, vat_rate: o.vat_rate, vat_included: String(o.vat_included),
      freight_model: o.freight_model, freight_basis: o.freight_basis || 'per_vehicle', freight_price: o.freight_price ?? '',
      freight_vat_rate: o.freight_vat_rate, freight_vat_included: String(o.freight_vat_included),
      start_date: o.start_date, planned_end_date: o.planned_end_date || '', status: o.status, notes: o.notes || '',
    })
  }

  async function openDetail(o) {
    setDetail(o); setHistory([])
    const { data } = await supabase.from('supply_freight_history').select('*').eq('order_id', o.id).order('changed_at', { ascending: false })
    setHistory(data || [])
  }

  async function save(e) {
    e.preventDefault(); setError('')
    const sep = form.freight_model === 'separate'
    if (form.planned_end_date && form.planned_end_date < form.start_date) { setError('Planlanan bitiş tarihi, başlangıç tarihinden önce olamaz.'); return }
    if (sep && form.freight_price === '') { setError('Ayrı nakliye bedeli için nakliye fiyatını girin.'); return }
    const payload = {
      company_id: companyId,
      supplier_id: form.supplier_id, product_id: form.product_id,
      planned_qty: Number(form.planned_qty), unit_price: Number(form.unit_price), price_unit: form.price_unit,
      vat_rate: Number(form.vat_rate), vat_included: form.vat_included === 'true',
      freight_model: form.freight_model,
      freight_basis: sep ? form.freight_basis : null,
      freight_price: sep ? Number(form.freight_price) : null,
      freight_vat_rate: Number(form.freight_vat_rate), freight_vat_included: form.freight_vat_included === 'true',
      start_date: form.start_date, planned_end_date: form.planned_end_date || null,
      status: form.status, notes: form.notes || null,
    }
    const res = form.id
      ? await supabase.from('supply_orders').update(payload).eq('id', form.id)
      : await supabase.from('supply_orders').insert(payload)
    if (res.error) { setError(res.error.message); return }
    setForm(null); load()
  }

  async function quickSave(e) {
    e.preventDefault(); setError('')
    const table = quick.kind === 'supplier' ? 'suppliers' : 'products'
    const { data, error } = await supabase.from(table).insert({ company_id: companyId, name: quick.name }).select('id').single()
    if (error) { setError(error.code === '23505' ? 'Bu isimde bir kayıt zaten var.' : error.message); return }
    setForm(f => ({ ...f, [quick.kind === 'supplier' ? 'supplier_id' : 'product_id']: data.id }))
    setQuick(null); load()
  }

  const needle = q.toLocaleLowerCase('tr-TR')
  const shown = orders.filter(o =>
    (!needle || `${orderNo(o.order_no)} ${sname(o.supplier_id)} ${pname(o.product_id)}`.toLocaleLowerCase('tr-TR').includes(needle)) &&
    (!statusFilter || o.status === statusFilter) &&
    (!onlyUnknown || (o.freight_model === 'unknown' && o.status !== 'cancelled')))

  const cnt = {
    active: orders.filter(o => ['active', 'partial'].includes(o.status)).length,
    done: orders.filter(o => o.status === 'completed').length,
    draft: orders.filter(o => o.status === 'draft').length,
    unknown: orders.filter(o => o.freight_model === 'unknown' && o.status !== 'cancelled').length,
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-icon"><Icon name="truck" size={24} /></div><div><div className="stat-label">Aktif tedarik</div><div className="stat-value">{cnt.active}</div></div></div>
        <div className="stat-card"><div className="stat-icon"><Icon name="check" size={24} /></div><div><div className="stat-label">Tamamlanan</div><div className="stat-value">{cnt.done}</div></div></div>
        <div className="stat-card"><div className="stat-icon"><Icon name="clock" size={24} /></div><div><div className="stat-label">Taslak / bekleyen</div><div className="stat-value">{cnt.draft}</div></div></div>
        <div className="stat-card"><div className="stat-icon"><Icon name="alert" size={24} /></div><div><div className="stat-label">Nakliyesi belirsiz</div><div className="stat-value">{cnt.unknown}</div></div></div>
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder="Tedarik no, tedarikçi veya ürün..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={() => setShowFilter(s => !s)}><Icon name="filter" size={16} /> Filtrele</button>
        <button className="btn btn-ghost" onClick={() => { setQ(''); setStatusFilter(''); setOnlyUnknown(false); setShowFilter(false) }}><Icon name="refresh" size={16} /> Sıfırla</button>
        {canManage && <button className="btn btn-primary" onClick={() => { setError(''); setForm(blankForm()) }}><Icon name="plus" size={18} /> Yeni Tedarik Ekle</button>}
      </div>
      {showFilter && (
        <div className="filter-row">
          <div style={{ minWidth: 220 }}>
            <label>Durum</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Tümü</option>
              {Object.entries(STATUS_TR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0, paddingTop: 22 }}>
            <input type="checkbox" checked={onlyUnknown} onChange={e => setOnlyUnknown(e.target.checked)} /> Sadece nakliyesi belirsiz olanlar
          </label>
        </div>
      )}
      {error && !form && <div className="error">{error}</div>}

      <div className="table-card">
        <div className="table-wrap">
          {loading ? <div className="empty">Yükleniyor...</div> : (
            <table>
              <thead>
                <tr><th>NO</th><th>TEDARİKÇİ</th><th>ÜRÜN</th><th>PLANLANAN</th><th>GERÇEKLEŞEN</th><th>KALAN</th><th>İLERLEME</th><th>ALIŞ FİYATI</th><th>NAKLİYE</th><th>BAŞLANGIÇ</th><th>DURUM</th><th>İŞLEMLER</th></tr>
              </thead>
              <tbody>
                {shown.map(o => {
                  const pg = progress(o, 0)
                  return (
                    <tr key={o.id}>
                      <td className="td-strong">{orderNo(o.order_no)}</td>
                      <td>{sname(o.supplier_id)}</td>
                      <td>{pname(o.product_id)}</td>
                      <td>{fmtNum(o.planned_qty, 3)} ton</td>
                      <td>{fmtNum(pg.received, 3)} ton</td>
                      <td>{fmtNum(pg.remaining, 3)} ton</td>
                      <td style={{ minWidth: 150 }}><ProgressBar pct={pg.pct} over={pg.over} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{priceText(o)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{freightText(o)}</td>
                      <td>{fmtDate(o.start_date)}</td>
                      <td><span className={`status ${STATUS_CLS[o.status]}`}><i />{STATUS_TR[o.status]}</span></td>
                      <td>
                        <div className="td-actions">
                          <button className="btn btn-blue btn-sm" onClick={() => openDetail(o)}><Icon name="eye" size={15} /> Detay</button>
                          {canManage && <button className="btn btn-violet btn-sm" onClick={() => editForm(o)}><Icon name="pencil" size={15} /> Düzenle</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!shown.length && <tr><td colSpan={12} className="empty">Tedarik kaydı yok. “Yeni Tedarik Ekle” ile başlayın.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {form && (
        <Modal title={form.id ? `Tedariği düzenle ${orderNo(orders.find(o => o.id === form.id)?.order_no || 0)}` : 'Yeni tedarik'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            {error && <div className="error">{error}</div>}
            <div className="grid">
              <div>
                <label>Tedarikçi *</label>
                <select value={form.supplier_id} required onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                  <option value="">Seçin</option>
                  {suppliers.filter(s => s.active || s.id === form.supplier_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setQuick({ kind: 'supplier', name: '' })}><Icon name="plus" size={14} /> Yeni tedarikçi</button>
              </div>
              <div>
                <label>Ürün *</label>
                <select value={form.product_id} required onChange={e => setForm({ ...form, product_id: e.target.value })}>
                  <option value="">Seçin</option>
                  {products.filter(p => p.active || p.id === form.product_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setQuick({ kind: 'product', name: '' })}><Icon name="plus" size={14} /> Yeni ürün</button>
              </div>
              <div><label>Planlanan toplam miktar (ton) *</label><input type="number" step="any" min="0" value={form.planned_qty} required onChange={e => setForm({ ...form, planned_qty: e.target.value })} /></div>
              <div><label>Ürün alış fiyatı *</label><input type="number" step="any" min="0" value={form.unit_price} required onChange={e => setForm({ ...form, unit_price: e.target.value })} /></div>
              <div>
                <label>Fiyat birimi *</label>
                <select value={form.price_unit} onChange={e => setForm({ ...form, price_unit: e.target.value })}>
                  <option value="TL/ton">TL / ton</option><option value="TL/kg">TL / kg</option>
                </select>
              </div>
              <div>
                <label>Ürün KDV oranı (%) *</label>
                <input type="number" step="any" min="0" max="100" value={form.vat_rate} required onChange={e => setForm({ ...form, vat_rate: e.target.value })} />
              </div>
              <div>
                <label>Ürün fiyatı KDV durumu</label>
                <select value={form.vat_included} onChange={e => setForm({ ...form, vat_included: e.target.value })}>
                  <option value="false">KDV hariç</option><option value="true">KDV dahil</option>
                </select>
              </div>
            </div>

            <div className="card" style={{ marginTop: 18, marginBottom: 0 }}>
              <label>Nakliye fiyatlandırma modeli *</label>
              <select value={form.freight_model} onChange={e => setForm({ ...form, freight_model: e.target.value })}>
                {Object.entries(FREIGHT_MODEL_TR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {form.freight_model === 'separate' && (
                <div className="grid" style={{ marginTop: 14 }}>
                  <div>
                    <label>Nakliye bedeli neye göre? *</label>
                    <select value={form.freight_basis} onChange={e => setForm({ ...form, freight_basis: e.target.value })}>
                      {Object.entries(FREIGHT_BASIS_TR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div><label>Nakliye fiyatı (TL) *</label><input type="number" step="any" min="0" value={form.freight_price} onChange={e => setForm({ ...form, freight_price: e.target.value })} /></div>
                  <div><label>Nakliye KDV oranı (%)</label><input type="number" step="any" min="0" max="100" value={form.freight_vat_rate} onChange={e => setForm({ ...form, freight_vat_rate: e.target.value })} /></div>
                  <div>
                    <label>Nakliye fiyatı KDV durumu</label>
                    <select value={form.freight_vat_included} onChange={e => setForm({ ...form, freight_vat_included: e.target.value })}>
                      <option value="false">KDV hariç</option><option value="true">KDV dahil</option>
                    </select>
                  </div>
                </div>
              )}
              {form.freight_model === 'included' && <div className="notice" style={{ marginTop: 14, marginBottom: 0 }}>Nakliye, yukarıdaki teslim fiyatına dahildir. Ayrıca nakliye bedeli eklenmez, çift hesaplama yapılmaz.</div>}
              {form.freight_model === 'unknown' && <div className="notice" style={{ marginTop: 14, marginBottom: 0 }}>Nakliye fiyatı kesinleşince tedariği düzenleyip “Ayrı nakliye bedeli” seçin. Değişiklikler geçmişte tutulur. Bu kayıtlar listede ayrıca filtrelenebilir.</div>}
            </div>

            <div className="grid" style={{ marginTop: 18 }}>
              <div><label>Başlangıç tarihi *</label><input type="date" value={form.start_date} required onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><label>Planlanan bitiş tarihi</label><input type="date" value={form.planned_end_date} onChange={e => setForm({ ...form, planned_end_date: e.target.value })} /></div>
              <div>
                <label>Durum</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_TR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}><label>Açıklama ve özel notlar</label><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Vazgeç</button>
              <button className="btn btn-primary">Kaydet</button>
            </div>
          </form>
        </Modal>
      )}

      {quick && (
        <Modal title={quick.kind === 'supplier' ? 'Yeni tedarikçi' : 'Yeni ürün'} onClose={() => setQuick(null)}>
          <form onSubmit={quickSave}>
            {error && <div className="error">{error}</div>}
            <label>{quick.kind === 'supplier' ? 'Tedarikçi adı' : 'Ürün adı'} *</label>
            <input value={quick.name} required autoFocus onChange={e => setQuick({ ...quick, name: e.target.value })} />
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setQuick(null)}>Vazgeç</button>
              <button className="btn btn-primary">Ekle</button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (() => {
        const o = detail
        const c = calcCosts(o)
        const pg = progress(o, 0)
        return (
          <Modal title={`Tedarik ${orderNo(o.order_no)} · ${pname(o.product_id)}`} onClose={() => setDetail(null)}>
            <div className="kv">
              <span>Tedarikçi</span><strong>{sname(o.supplier_id)}</strong>
              <span>Durum</span><span><span className={`status ${STATUS_CLS[o.status]}`}><i />{STATUS_TR[o.status]}</span></span>
              <span>Tarihler</span><strong>{fmtDate(o.start_date)} → {o.planned_end_date ? fmtDate(o.planned_end_date) : 'belirsiz'}</strong>
              <span>Planlanan</span><strong>{fmtNum(o.planned_qty, 3)} ton</strong>
              <span>Alış fiyatı</span><strong>{priceText(o)}</strong>
              <span>Nakliye</span><strong>{FREIGHT_MODEL_TR[o.freight_model]}{o.freight_model === 'separate' ? ` · ${freightText(o)}` : ''}</strong>
              {o.notes && (<><span>Not</span><strong>{o.notes}</strong></>)}
            </div>

            <div style={{ margin: '18px 0 6px' }}><strong>İlerleme</strong></div>
            <ProgressBar pct={pg.pct} over={pg.over} />
            <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>Gerçekleşen tonaj, kantar kayıtları onaylandıkça otomatik güncellenecek (sonraki aşama).</p>

            <div style={{ margin: '18px 0 8px' }}><strong>Tahmini maliyet (planlanan tonaj üzerinden)</strong></div>
            <div className="kv">
              <span>Ürün (KDV hariç)</span><strong>{fmtTRY(c.productNet)}</strong>
              <span>Ürün KDV</span><strong>{fmtTRY(c.productVat)}</strong>
              <span>Ürün toplamı</span><strong>{fmtTRY(c.productGross)}</strong>
              {c.freight === 'known' && (<><span>Nakliye (KDV hariç)</span><strong>{fmtTRY(c.freightNet)}</strong><span>Nakliye KDV</span><strong>{fmtTRY(c.freightVat)}</strong></>)}
              {c.freight === 'included' && (<><span>Nakliye</span><strong>Teslim fiyatına dahil</strong></>)}
              {c.freight === 'unknown' && (<><span>Nakliye</span><strong>Belirsiz, toplama eklenmedi</strong></>)}
              {c.freight === 'vehicle' && (<><span>Nakliye</span><strong>Araç sayısına göre kantar kayıtlarından hesaplanacak</strong></>)}
              <span>Genel toplam</span><strong>{fmtTRY(c.grand)}{c.freight === 'unknown' || c.freight === 'vehicle' ? ' (nakliye hariç)' : ''}</strong>
            </div>

            <div style={{ margin: '18px 0 8px' }}><strong>Nakliye değişiklik geçmişi</strong></div>
            {!history.length ? <p className="muted" style={{ margin: 0 }}>Kayıt yok.</p> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>TARİH</th><th>ÖNCE</th><th>SONRA</th></tr></thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(h.changed_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="muted">{h.old_model ? `${FREIGHT_MODEL_TR[h.old_model]}${h.old_price != null ? ` · ${fmtNum(h.old_price, 2)} TL / ${FREIGHT_BASIS_TR[h.old_basis]}` : ''}` : '-'}</td>
                        <td>{FREIGHT_MODEL_TR[h.new_model]}{h.new_price != null ? ` · ${fmtNum(h.new_price, 2)} TL / ${FREIGHT_BASIS_TR[h.new_basis]}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal-foot">
              {canManage && <button className="btn btn-violet" onClick={() => { const x = detail; setDetail(null); editForm(x) }}><Icon name="pencil" size={16} /> Düzenle</button>}
              <button className="btn btn-primary" onClick={() => setDetail(null)}>Kapat</button>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
