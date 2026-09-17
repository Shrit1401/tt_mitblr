import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'DOMINO | Room to move forward',
  description:
    'A thoughtful loan-officer workspace for cash-flow-aligned repayment. An interactive prototype by NueraRangers.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
