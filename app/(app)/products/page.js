import { getContext } from '@/lib/session'
import PageHeader from '@/components/PageHeader'
import TenantCrud from '@/components/TenantCrud'

export default async function ProductsPage() {
  const { active } = await getContext()
  if (!['company_admin', 'purchasing'].includes(active.role)) return <div className="error">Bu sayfaya erişim yetkiniz yok.</div>
  return (
    <div>
      <PageHeader icon="layers" title="Ürünler" subtitle="Satın aldığınız hammaddeleri tanımlayın (örn. mısır, arpa, buğday)." />
      <TenantCrud
        table="products" companyId={active.company.id} canManage newLabel="Yeni ürün"
        fields={[
          { key: 'name', label: 'Ürün adı', required: true },
          { key: 'code', label: 'Ürün kodu' },
          { key: 'notes', label: 'Notlar', type: 'textarea' },
          { key: 'active', label: 'Aktif', type: 'checkbox' },
        ]}
        columns={[
          { key: 'name', label: 'ÜRÜN', strong: true }, { key: 'code', label: 'KOD' },
          { key: 'notes', label: 'NOT' }, { key: 'active', label: 'DURUM', type: 'bool' },
        ]}
      />
    </div>
  )
}
