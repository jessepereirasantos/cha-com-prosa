import type { Metadata } from 'next';
import { Noto_Serif, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const notoSerif = Noto_Serif({ subsets: ['latin'], variable: '--font-serif', weight: ['400', '600', '700'] });

export const metadata: Metadata = {
  title: 'Chá com Prosa | Mulheres com Propósito',
  description: 'Um encontro para mulheres que buscam conhecer mais do Deus e seu propósito.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${plusJakartaSans.variable} ${notoSerif.variable}`}>
      <body className="font-sans antialiased text-stone-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
