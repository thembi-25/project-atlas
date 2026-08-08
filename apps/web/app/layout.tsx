import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Project Atlas',
  description: 'The operations platform for field-service businesses.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
