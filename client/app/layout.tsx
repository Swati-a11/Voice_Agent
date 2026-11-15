import type { Metadata } from 'next';
import './globals.css';
import { VoiceAgentProvider } from '../context/VoiceAgentContext';
import { AppShell } from '../components/AppShell';

export const metadata: Metadata = {
  title: 'Ira — Your voice companion',
  description: 'Truly human-like real-time conversational AI voice companion with sub-400ms latency, natural Hinglish, and instant interruptions.',
  icons: { icon: '/ira-mark.svg', apple: '/ira-mark.svg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light">
      <body className="antialiased min-h-screen">
        <VoiceAgentProvider>
          <AppShell>
            {children}
          </AppShell>
        </VoiceAgentProvider>
      </body>
    </html>
  );
}
