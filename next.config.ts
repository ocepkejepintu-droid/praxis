import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  outputFileTracingExcludes: {
    '/*': [
      './next.config.*',
      './.next/**/*',
      './.git/**/*',
      './.omx/artifacts/**/*',
      './tsconfig.tsbuildinfo',
    ],
  },
};

export default nextConfig;
