import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Aynı istekte layout ve sayfa birlikte çağırsa bile veritabanına TEK sefer gider (cache).
// Kimlik doğrulama middleware'de yapılır; burada çerezdeki oturum okunur, tüm veri sorguları
// ise veritabanında RLS ile ayrıca doğrulanır.
export const getContext = cache(async () => {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { user: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, memberships(id, role, active, company:companies(id, name, code, status, license_start, license_end))')
    .eq('id', user.id)
    .single()

  const memberships = (profile?.memberships || []).filter(m => m.active && m.company)
  const wanted = cookies().get('active_company')?.value
  const active = memberships.find(m => m.company.id === wanted) || memberships[0] || null
  return { user, profile, memberships, active }
})
