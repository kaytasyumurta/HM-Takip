import { redirect } from 'next/navigation'
import { getContext } from '@/lib/session'
import AppShell from '@/components/AppShell'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }) {
  const ctx = await getContext()
  if (!ctx.user) redirect('/login')
  if (!ctx.profile?.is_super_admin) redirect('/')
  const items = [
    { href: '/admin', label: 'Firma Yönetimi', icon: 'building' },
    { label: 'Lisans Anahtarları', icon: 'key', disabled: true },
    { label: 'İşlem Kayıtları', icon: 'history', disabled: true },
  ]
  return (
    <AppShell items={items} contextLabel="Merkezi Yönetim"
      userName={ctx.profile.full_name || ctx.profile.email} roleLabel="SÜPER ADMİN">
      {children}
    </AppShell>
  )
}
