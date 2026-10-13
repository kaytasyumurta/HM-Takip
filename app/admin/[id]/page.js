'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MembersManager from '@/components/MembersManager'
import { fmtDate } from '@/lib/format'

export default function CompanyDetail() {
  const { id } = useParams()
  const supabase = useMemo(() => createClient(), [])
  const [company, setCompany] = useState(null)
  const [me, setMe] = useState(null)

  useEffect(() => {
    supabase.from('companies').select('*').eq('id', id).single().then(({ data }) => setCompany(data))
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id))
  }, [id])

  if (!company) return <p className="muted">Yükleniyor...</p>
  return (
    <div>
      <p><Link href="/admin" className="muted">← Firmalara dön</Link></p>
      <h1>{company.name} <span className="muted" style={{ fontSize: 14 }}>({company.code}) · Lisans bitişi: {fmtDate(company.license_end)}</span></h1>
      <MembersManager companyId={id} selfId={me} />
    </div>
  )
}
