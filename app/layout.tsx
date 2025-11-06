import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Acil Servis Görev Yönetimi',
  description: 'Acil servis için görev ve task yönetim uygulaması',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}






