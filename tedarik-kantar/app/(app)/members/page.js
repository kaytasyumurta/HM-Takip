import { getContext } from '@/lib/session'
import MembersManager from '@/components/MembersManager'

export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  const { active, user } = await getContext()
  if (active.role !== 'company_admin') return <p className="error">Bu sayfaya erişim yetkiniz yok.</p>
  return (
    <div>
      <h1>Firma Kullanıcıları</h1>
      <MembersManager companyId={active.company.id} selfId={user.id} />
    </div>
  )
}
