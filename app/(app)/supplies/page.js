import { getContext } from '@/lib/session'
import PageHeader from '@/components/PageHeader'
import SupplyManager from '@/components/SupplyManager'

export default async function SuppliesPage() {
  const { active } = await getContext()
  if (!['company_admin', 'purchasing'].includes(active.role)) return <div className="error">Bu sayfaya erişim yetkiniz yok.</div>
  return (
    <div>
      <PageHeader icon="truck" title="Hammadde Tedarik Yönetimi" subtitle="Tedarik emirlerini, fiyatları, nakliye modellerini ve ilerlemeyi takip edin." />
      <SupplyManager companyId={active.company.id} canManage />
    </div>
  )
}
