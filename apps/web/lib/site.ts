import { SITE } from "@teire/engine/constants";

/**
 * Links every surface shares. The App's slug is public (it is in its install URL); the GitHub
 * repository is Teire's own source.
 */
export const APP_SLUG = process.env.GITHUB_APP_SLUG ?? "teire-otari";
export const INSTALL_URL = `https://github.com/apps/${APP_SLUG}/installations/new`;
/**
 * GitHub's account picker for the App (Codex walk B11): `installations/new` sends a person whose
 * only account already has Teire straight to that installation; this lists every account and
 * organization they can install it on.
 */
export const ADD_ACCOUNT_URL = `https://github.com/apps/${APP_SLUG}/installations/select_target`;
export const SOURCE_URL = SITE.sourceUrl;
/** The CLI and MCP server ship from this repository; this instance publishes nothing to npm. */
export const CLI_DOCS_URL = "/docs/build/cli";

export const NAV = [
  { href: "/changes", label: "Changes" },
  { href: "/scan", label: "Scan" },
  { href: "/docs", label: "Docs" },
  { href: "/trust", label: "Trust" },
] as const;
