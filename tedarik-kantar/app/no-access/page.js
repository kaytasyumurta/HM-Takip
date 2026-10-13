import LogoutButton from '@/components/LogoutButton'

export default function NoAccess() {
  return (
    <div className="center">
      <div className="card auth">
        <h1>Firma Üyeliği Yok</h1>
        <p className="muted">Hesabınız herhangi bir aktif firmaya bağlı değil. Firma yöneticinizden sizi firmaya eklemesini isteyin.</p>
        <LogoutButton />
      </div>
    </div>
  )
}
