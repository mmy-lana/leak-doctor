import React from 'react';

export const metadata = {
  title: 'LeakDoctor Web Scanner',
  description: 'Headless DOM & JS Heap Memory Leak Audit Tool',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#090d16' }}>
        {children}
      </body>
    </html>
  );
}