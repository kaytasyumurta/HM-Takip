import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Sunucu tarafında oturum + firma üyeliği doğrulaması
export async function getContext() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null }
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: rows } = await supabase
    .from('memberships')
    .select('id, role, active, company:companies(id, name, code, status, license_start, license_end)')
    .eq('user_id', user.id)
    .eq('active', true)
  const memberships = (rows || []).filter(m => m.company)
  const wanted = cookies().get('active_company')?.value
  const active = memberships.find(m => m.company.id === wanted) || memberships[0] || null
  return { user, profile, memberships, active }
}
