/** @type {import('next').NextConfig} */
const nextConfig = {
  /*
   * Version skew protection.
   *
   * A deploy replaces the Server Action IDs and the RSC payload format, but
   * it does not replace the JavaScript already running in a tab someone left
   * open. That tab then posts an action ID the new build has never heard of,
   * and the server answers "The Server Reference ID did not match the
   * expected format" — which reaches the user as a button that does nothing,
   * or an error blaming whatever they typed. It is not a rare race: every
   * redeploy opens the window, and a tool people keep open all day is exactly
   * where it bites.
   *
   * With a deployment id set, Next.js stamps it on assets and navigations and
   * the client compares it against the server's. A mismatch becomes a hard
   * reload onto the current build instead of a silent failure.
   *
   * `VERCEL_DEPLOYMENT_ID` is provided by Vercel at build time. Everywhere
   * else this is `undefined` and the option is inert, so local development
   * and self-hosting are unaffected — set `NEXT_DEPLOYMENT_ID` at build time
   * to get the same protection off Vercel.
   *
   * The reload still discards unsaved input, so it is the floor, not the
   * ceiling: Vercel's Skew Protection setting routes the stale request to the
   * deployment it came from and the action simply succeeds. Turn that on too.
   */
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
};

export default nextConfig;
