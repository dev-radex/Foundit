import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'FoundIt — University of Ilorin',
  description:
    'A privacy-first lost-and-found community. Report, match and safely recover your belongings.',
  icons: { icon: '/favicon.svg' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
