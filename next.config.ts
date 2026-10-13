import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static site, no server: all data goes straight from the browser to Firestore.
  // Data protection lives in firestore.rules, not in any API route.
  output: 'export',
  // /days -> /days/index.html: any static host serves it right, SW cache included.
  trailingSlash: true,
  // The /days -> /days/ redirect lives in vercel.json, not Next: on Vercel,
  // Next's redirect runs before the /__/auth route, turning /__/auth/handler into
  // /__/auth/handler/, which firebaseapp.com does not serve.
  skipTrailingSlashRedirect: true,
  // Next's dev badge covers the bottom corner of the writing page.
  devIndicators: false,
};

export default nextConfig;
