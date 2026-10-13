export const ROLE_TR = {
  company_admin: 'Firma Yöneticisi',
  weighbridge: 'Kantar Personeli',
  purchasing: 'Satın Alma / Tedarik',
}
export const LICENSE_TR = {
  active: 'Aktif', soon: 'Süresi Yaklaşıyor', expired: 'Süresi Doldu', passive: 'Pasif',
}

export function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('tr-TR') : ''
}

export function daysLeft(end) {
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86400000)
}

export function licenseState(c) {
  if (c.status !== 'active') return 'passive'
  const d = daysLeft(c.license_end)
  if (d <= 0) return 'expired'
  if (d <= 7) return 'soon'
  return 'active'
}
