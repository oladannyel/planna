/** @type {import('next').NextConfig} */
const nextConfig = {
  /*
   * `next build` and `next dev` share `.next` by default, so running a build
   * while a dev server is up clobbers the dev server's output: the app then
   * serves HTML where its stylesheet should be and renders completely
   * unstyled, with no error anywhere — the dev server looks healthy.
   *
   * Setting NEXT_DIST_DIR sends a build to its own directory instead. The
   * `build:check` script uses it, so gate runs can never disturb a running
   * dev server. A plain `next build` (what Vercel runs) is unaffected.
   */
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
