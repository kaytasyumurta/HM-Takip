'use client'
import { useEffect } from 'react'
import Icon from '@/components/Icon'

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <span>{title}</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Kapat"><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
