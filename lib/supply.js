export const STATUS_TR = {
  draft: 'Taslak', active: 'Aktif', partial: 'Kısmen teslim edildi', completed: 'Tamamlandı', cancelled: 'İptal edildi',
}
export const STATUS_CLS = { draft: 'draft', active: 'active', partial: 'soon', completed: 'done', cancelled: 'passive' }
export const FREIGHT_MODEL_TR = {
  separate: 'Ayrı nakliye bedeli', included: 'Nakliye dahil teslim fiyatı', unknown: 'Nakliye fiyatı belirsiz',
}
export const FREIGHT_BASIS_TR = { per_vehicle: 'araç başına', per_ton: 'ton başına', total: 'toplam tedarik için' }

const nf = d => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d })
export const fmtNum = (n, d = 0) => (n === null || n === undefined || n === '' ? '-' : nf(d).format(Number(n)))
export const fmtTRY = n => (n === null || n === undefined ? '-' : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n))
export const orderNo = n => '#' + String(n).padStart(3, '0')

export function priceText(o) {
  const base = `${fmtNum(o.unit_price, 2)} ${o.price_unit}`
  return o.vat_included ? `${base} (KDV dahil)` : `${base} + KDV %${Number(o.vat_rate)}`
}

export function freightText(o) {
  if (o.freight_model === 'included') return 'Nakliye dahil'
  if (o.freight_model === 'unknown') return 'Belirsiz'
  const kdv = o.freight_vat_included ? '(KDV dahil)' : '+ KDV'
  return `${fmtNum(o.freight_price, 2)} TL / ${FREIGHT_BASIS_TR[o.freight_basis]} ${kdv}`
}

// Planlanan tonaj üzerinden TAHMİNİ maliyet. Nakliye dahil modelde nakliye ayrıca eklenmez (çift hesap yok).
export function calcCosts(o) {
  const qty = Number(o.planned_qty)
  const perTon = o.price_unit === 'TL/kg' ? Number(o.unit_price) * 1000 : Number(o.unit_price)
  const rate = Number(o.vat_rate) / 100
  const netPerTon = o.vat_included ? perTon / (1 + rate) : perTon
  const productNet = netPerTon * qty
  const productVat = productNet * rate
  const out = { productNet, productVat, productGross: productNet + productVat, freight: 'none' }

  if (o.freight_model === 'separate') {
    const fr = Number(o.freight_vat_rate) / 100
    let raw = null
    if (o.freight_basis === 'per_ton') raw = Number(o.freight_price) * qty
    else if (o.freight_basis === 'total') raw = Number(o.freight_price)
    if (raw === null) out.freight = 'vehicle'
    else {
      const net = o.freight_vat_included ? raw / (1 + fr) : raw
      out.freight = 'known'
      out.freightNet = net; out.freightVat = net * fr; out.freightGross = net + net * fr
    }
  } else if (o.freight_model === 'unknown') out.freight = 'unknown'
  else out.freight = 'included'

  out.grand = out.productGross + (out.freight === 'known' ? out.freightGross : 0)
  return out
}

// Gerçekleşen tonaj, onaylı kantar kayıtlarının net toplamıdır (veritabanında otomatik hesaplanır).
export function progress(o, received = Number(o.received_kg || 0) / 1000) {
  const planned = Number(o.planned_qty)
  const pct = planned > 0 ? (received / planned) * 100 : 0
  return { received, remaining: Math.max(0, planned - received), pct, over: received > planned, overBy: Math.max(0, received - planned) }
}
