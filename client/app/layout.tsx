import type { Metadata } from 'next';
import './globals.css';
import { VoiceAgentProvider } from '../context/VoiceAgentContext';
import { AppShell } from '../components/AppShell';

export const metadata: Metadata = {
  title: 'Ayra — Personal AI Voice Companion',
  description: 'Truly human-like real-time conversational AI voice companion with sub-400ms latency, natural Hinglish, and instant interruptions.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#05030a] text-[#f8f7fb]">
        <VoiceAgentProvider>
          <AppShell>
            {children}
          </AppShell>
        </VoiceAgentProvider>
      </body>
    </html>
  );
}
