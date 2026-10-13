'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MembersManager from '@/components/MembersManager'
import PageHeader from '@/components/PageHeader'
import Icon from '@/components/Icon'
import { fmtDate, daysLeft, licenseState, LICENSE_TR } from '@/lib/format'

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
  const st = licenseState(company)
  return (
    <div>
      <PageHeader icon="building" title={company.name} subtitle={`Firma kodu: ${company.code} · Lisans bitişi: ${fmtDate(company.license_end)} (${daysLeft(company.license_end)} gün)`}>
        <span className={`status ${st}`}><i />{LICENSE_TR[st]}</span>
        <Link href="/admin" className="btn btn-ghost"><Icon name="back" size={16} /> Firmalara dön</Link>
      </PageHeader>
      <MembersManager companyId={id} selfId={me} />
    </div>
  )
}
