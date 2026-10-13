'use client'
import Icon from '@/components/Icon'

export default function PageHeader({ icon, title, subtitle, children }) {
  return (
    <div className="page-header">
      <div className="ph-icon"><Icon name={icon} size={28} /></div>
      <div>
        <h1 className="ph-title">{title}</h1>
        {subtitle && <div className="ph-sub">{subtitle}</div>}
      </div>
      {children && <div className="ph-actions">{children}</div>}
    </div>
  )
}
