import PageHeader from '@/components/PageHeader'
import KeyManager from '@/components/KeyManager'

export default function KeysPage() {
  return (
    <div>
      <PageHeader icon="key" title="Lisans Anahtarları" subtitle="Firmalar için lisans uzatma anahtarı oluşturun, kullanım durumunu izleyin." />
      <KeyManager />
    </div>
  )
}
