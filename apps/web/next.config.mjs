import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import("next").NextConfig} */
const nextConfig = {
  // The container image (apps/web/Dockerfile) runs the standalone server; local builds stay as they were.
  ...(process.env.NEXT_OUTPUT === "standalone"
    ? { output: "standalone", outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)) }
    : {}),
  cacheComponents: true,
  devIndicators: false,
  partialPrefetching: true,
  reactCompiler: true,
  transpilePackages: ["@teire/db", "@teire/engine"],
  /** Short URLs: the docs sections live under their tabs. */
  async redirects() {
    return [
      { source: "/docs", destination: "/docs/guide", permanent: false },
      { source: "/docs/cli", destination: "/docs/build/cli", permanent: false },
      { source: "/docs/mcp", destination: "/docs/build/mcp", permanent: false },
      { source: "/docs/config", destination: "/docs/guide/configuration", permanent: false },
    ];
  },
};

export default withMDX(nextConfig);
