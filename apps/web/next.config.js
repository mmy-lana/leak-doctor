/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/scan': ['./node_modules/@sparticuz/chromium/bin/*'],
    '/api/scan/route': ['./node_modules/@sparticuz/chromium/bin/*'],
  },
};

module.exports = nextConfig;