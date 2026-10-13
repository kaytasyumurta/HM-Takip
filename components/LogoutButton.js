'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/Icon'

export default function LogoutButton({ iconOnly = false }) {
  const router = useRouter()
  async function logout() {
    await createClient().auth.signOut()
    document.cookie = 'active_company=; path=/; max-age=0'
    router.push('/login'); router.refresh()
  }
  if (iconOnly) {
    return <button className="icon-btn danger" onClick={logout} title="Çıkış" aria-label="Çıkış"><Icon name="power" /></button>
  }
  return <button className="btn btn-ghost" onClick={logout}><Icon name="power" size={16} /> Çıkış</button>
}
