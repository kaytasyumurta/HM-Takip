import { getContext } from '@/lib/session'
import PageHeader from '@/components/PageHeader'
import WeighbridgeManager from '@/components/WeighbridgeManager'

export default async function WeighbridgePage() {
  const { active, user } = await getContext()
  return (
    <div>
      <PageHeader icon="scale" title="Kantar Kayıtları" subtitle="Kantara giren araçları kaydedin; onaylanan net tonaj tedarik ilerlemesine otomatik eklenir." />
      <WeighbridgeManager companyId={active.company.id} companyName={active.company.name} userId={user.id} role={active.role} />
    </div>
  )
}
