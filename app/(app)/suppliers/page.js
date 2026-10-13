import { getContext } from '@/lib/session'
import PageHeader from '@/components/PageHeader'
import TenantCrud from '@/components/TenantCrud'

export default async function SuppliersPage() {
  const { active } = await getContext()
  if (!['company_admin', 'purchasing'].includes(active.role)) return <div className="error">Bu sayfaya erişim yetkiniz yok.</div>
  return (
    <div>
      <PageHeader icon="building" title="Tedarikçiler" subtitle="Hammadde aldığınız firmaları yönetin." />
      <TenantCrud
        table="suppliers" companyId={active.company.id} canManage newLabel="Yeni tedarikçi"
        fields={[
          { key: 'name', label: 'Tedarikçi adı', required: true },
          { key: 'contact_person', label: 'Yetkili kişi' },
          { key: 'phone', label: 'Telefon' },
          { key: 'email', label: 'E-posta' },
          { key: 'city', label: 'Şehir' },
          { key: 'tax_no', label: 'Vergi no' },
          { key: 'address', label: 'Adres', type: 'textarea' },
          { key: 'notes', label: 'Notlar', type: 'textarea' },
          { key: 'active', label: 'Aktif', type: 'checkbox' },
        ]}
        columns={[
          { key: 'name', label: 'TEDARİKÇİ', strong: true }, { key: 'contact_person', label: 'YETKİLİ' },
          { key: 'phone', label: 'TELEFON' }, { key: 'city', label: 'ŞEHİR' }, { key: 'active', label: 'DURUM', type: 'bool' },
        ]}
      />
    </div>
  )
}
