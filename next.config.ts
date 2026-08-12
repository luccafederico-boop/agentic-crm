import type { NextConfig } from "next";

// Defense-in-depth headers. Vercel already adds HSTS; these cover clickjacking,
// MIME sniffing, referrer leakage and feature access. No CSP here — Next's
// inline runtime scripts would need a nonce pipeline; frame-ancestors 'none'
// via X-Frame-Options covers the main risk for an authed CRM.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
