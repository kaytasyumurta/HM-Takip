import './globals.css'

export const metadata = { title: 'Tedarik Pro | Tedarik ve Kantar Takip' }

const themeScript = `try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}`

export default function RootLayout({ children }) {
  return (
    <html lang="tr" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
