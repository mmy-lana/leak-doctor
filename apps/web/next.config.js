/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/scan': [
      './node_modules/@sparticuz/chromium/bin/*',
      '../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/*',
      '../../node_modules/@sparticuz/chromium/bin/*',
    ],
  },
};

module.exports = nextConfig;