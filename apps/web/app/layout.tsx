import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'leak-doctor — JavaScript Memory Leak & Detached DOM Auditor',
  description: 'Zero-dependency frontend memory leak diagnostic suite and headless Chromium DOM & JS heap auditor leveraging WeakRef and FinalizationRegistry.',
  keywords: [
    'leak-doctor',
    'leak doctor',
    'leak doctor github',
    'detached dom',
    'memory leak auditor',
    'javascript heap leak',
    'react 19 memory leak',
    'mmy-lana',
  ],
  authors: [{ name: 'Muhammad Maulana Yusuf', url: 'https://github.com/mmy-lana' }],
  verification: {
    google: 'kHFv2qyOjv4Th7trKaPXsJom5ZKq5zYf_pZpdXYvA58',
  },
  openGraph: {
    title: 'leak-doctor — JavaScript Memory Leak & Detached DOM Auditor',
    description: 'Diagnose detached DOM nodes, JS heap growth, and uncleared event listeners in real time.',
    url: 'https://leak-doctor-web.vercel.app',
    siteName: 'leak-doctor',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'leak-doctor',
    description: 'Zero-dependency JavaScript memory leak and detached DOM auditor.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="google-site-verification" content="kHFv2qyOjv4Th7trKaPXsJom5ZKq5zYf_pZpdXYvA58" />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#090d16' }}>
        {children}
      </body>
    </html>
  );
}