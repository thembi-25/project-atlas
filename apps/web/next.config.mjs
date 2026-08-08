/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile internal workspace packages that ship untranspiled TS —
  // see docs/08-engineering/project-structure.md for the monorepo layout.
  transpilePackages: ['@atlas/ui', '@atlas/auth', '@atlas/database', '@atlas/config'],
  eslint: {
    // Linting is run as its own CI step (see docs/10-devops/ci-cd.md); no
    // need to duplicate it inside `next build`.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
