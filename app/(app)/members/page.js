import { getContext } from '@/lib/session'
import MembersManager from '@/components/MembersManager'
import PageHeader from '@/components/PageHeader'

export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  const { active, user } = await getContext()
  if (active.role !== 'company_admin') return <div className="error">Bu sayfaya erişim yetkiniz yok.</div>
  return (
    <div>
      <PageHeader icon="users" title="Firma Kullanıcıları" subtitle="Firmanıza kullanıcı ekleyin, rollerini yönetin." />
      <MembersManager companyId={active.company.id} selfId={user.id} />
    </div>
  )
}
