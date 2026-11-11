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
      // The model section moved with the gateway (S06): old links land on its Otari pages.
      // The demo, until the recorded video is embedded on its own page: the live run it walks through.
      { source: "/demo", destination: "/runs/c154b1d4-ed40-4860-912d-5c587916c2e2", permanent: false },
      { source: "/docs/nemotron", destination: "/docs/otari", permanent: true },
      { source: "/docs/nemotron/receipts", destination: "/docs/otari/receipts", permanent: true },
      { source: "/docs/nemotron/evaluation", destination: "/docs/otari/evaluation", permanent: true },
    ];
  },
};

export default withMDX(nextConfig);
