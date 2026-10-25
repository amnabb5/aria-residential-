import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* Gzip/brotli responses served by the standalone Node server. */
  compress: true,
  /* config options here */
  typescript: {
    // Re-enabled: all type errors are fixed — the build should fail loudly
    // if new ones are introduced.
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  /**
   * Cross-Origin isolation headers — required by @mkkellogg/gaussian-splats-3d
   * to enable SharedArrayBuffer (WASM sort + gpuAcceleratedSort).
   *
   * If your deployment can't set these (e.g. some static hosts), set
   *   sharedMemoryForWorkers: false  and  gpuAcceleratedSort: false
   * in GaussianSplat.tsx — sorting still works via non-shared buffers, just slower.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
      // Heavy immutable assets: cache for a year (filenames never change
      // in-place — regenerate assets under a new name if you replace them).
      {
        source: "/models/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/hdri/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
