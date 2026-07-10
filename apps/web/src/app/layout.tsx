import type { Metadata } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { getWebEnv } from '@/env';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
});

const env = getWebEnv();

export const metadata: Metadata = {
  title: env.NEXT_PUBLIC_PLATFORM_DISPLAY_NAME,
  description: 'AI receptionist and operating system for independent UK hair professionals.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className={`${dmSans.variable} ${fraunces.variable} min-h-screen antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
