'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()
  async function logout() {
    await createClient().auth.signOut()
    document.cookie = 'active_company=; path=/; max-age=0'
    router.push('/login'); router.refresh()
  }
  return <button className="ghost" onClick={logout}>Çıkış</button>
}
