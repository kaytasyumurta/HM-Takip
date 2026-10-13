import PageHeader from '@/components/PageHeader'
import LicenseHistory from '@/components/LicenseHistory'

export default function LogsPage() {
  return (
    <div>
      <PageHeader icon="history" title="İşlem Kayıtları" subtitle="Lisans, anahtar ve aktivasyon geçmişi. Hatalı anahtar denemeleri de burada görünür." />
      <LicenseHistory showCompany />
    </div>
  )
}
