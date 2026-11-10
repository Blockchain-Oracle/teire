/**
 * Liveness for the container's health check: the server answers. It deliberately checks nothing
 * else, so a slow database or model provider never takes the site out of routing; /api/health and
 * /trust report those.
 */
export function GET() {
  return new Response("ok", { headers: { "cache-control": "no-store" } });
}
