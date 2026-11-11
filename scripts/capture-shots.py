"""Retake the docs screenshots.

Public pages come from production (real runs, reports and catalog), captured headless here. Signed-in
pages (the dashboard, settings, Ask Teire) are captured from a browser where the owner signed in
themselves, saved as PNGs named `<name>-desktop.png` or `<name>-phone.png` into one folder; no session
token passes through this script. `convert` turns such a folder into the docs' light WebPs in
apps/web/public/shots (wide and phone) and a fresh size map in apps/web/lib/shots.json.

Run (playwright is not a dependency of this repo):
  uv run --with playwright python scripts/capture-shots.py public [name ...]
  uv run --with playwright python scripts/capture-shots.py convert <folder of PNGs>
"""

import glob
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "apps/web"
PROD = os.environ.get("TEIRE_PUBLIC_URL", "https://teire.84.46.247.92.sslip.io")
DESKTOP = {"viewport": {"width": 1920, "height": 1080}, "device_scale_factor": 1}
PHONE = {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 3, "is_mobile": True, "has_touch": True}
# Otari-era runs on the demo repositories: three retired OpenAI models fixed by GLM 5.3 (bristow#8),
# and two retired Anthropic models swapped by deterministic edits (bristow#7).
BRISTOW = "/runs/c154b1d4-ed40-4860-912d-5c587916c2e2"
ANTHROPIC = "/runs/30fe9028-4ec2-489c-b91b-7200d9b488f0"

# (name, path, devices, action) on production. An action is None, ("console",) to bring the run's
# bottom panel to the top, ("tab", label) to open a run tab first, or ("focus", element id).
DOCS = [
    ("run-sheet", BRISTOW + "?tile=check", ["desktop"], None),
    ("run-sheet-receipt", BRISTOW, ["desktop"], ("tab", "Receipt")),
    ("pr-bristow", BRISTOW, ["desktop"], ("console",)),
    ("pr-anthropic", ANTHROPIC, ["desktop", "phone"], ("console",)),
    ("change-detail", "/changes/anthropic-2026-11-30-claude-sonnet-4-5-20250929", ["desktop"], None),
    ("package-anthropic", "/packages/pypi/anthropic", ["desktop"], None),
    ("scan", "/scan", ["desktop", "phone"], None),
    ("trust", "/trust", ["desktop"], None),
]
# Signed in, captured in a signed-in browser at the same sizes (1920x1080 desktop, 390x844 phone):
# dashboard (/app), repos, repo-findings, findings-ruby (faraday open on examples), runtime-notice
# (Node.js 20 open on examples), repo-config, changes-for-you, settings (/app/settings/usage),
# allowances (/app/settings/allowances), welcome, ask-overview, ask-docked, ask-why, ask-action,
# ask (phone), and the public reports report-axios (and phone), report-flask, report-gin (scans
# started signed in). Last taken 2026-11-11 on the Blockchain-Oracle installation.
CONSOLE = "() => { const t = document.querySelector('[role=tablist]'); if (t) window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 96); }"
FOCUS = "(id) => { const e = document.getElementById(id); if (e) window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 140); }"


def launch(p):
    try:
        return p.chromium.launch()
    except Exception:
        cache = os.path.expanduser("~/Library/Caches/ms-playwright")
        found = sorted(glob.glob(cache + "/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell"))
        if not found:
            raise SystemExit("No Chromium: run `uv run --with playwright playwright install chromium` once.")
        return p.chromium.launch(executable_path=found[-1])


def shoot(browser, path, device, theme, action, out):
    ctx = browser.new_context(color_scheme=theme, **device)
    ctx.add_init_script(f"try {{ localStorage.setItem('theme', '{theme}') }} catch {{}}")
    page = ctx.new_page()
    page.goto(PROD + path, wait_until="networkidle")
    page.wait_for_timeout(2500)
    kind = action[0] if action else None
    if kind == "tab":
        page.get_by_role("tab", name=action[1]).click()
        page.wait_for_timeout(800)
    if kind in ("tab", "console"):
        page.evaluate(CONSOLE)
    if kind == "focus":
        page.evaluate(FOCUS, action[1])
    page.wait_for_timeout(1200)
    page.mouse.move(0, 0)
    page.screenshot(path=out)
    ctx.close()


def convert(folder: Path):
    """PNG captures → the docs' WebPs at their widths, then the size map the <Shot> components read."""
    for f in sorted(folder.glob("*.png")):
        stem = f.stem
        if stem.endswith("-phone"):
            subprocess.run(["magick", str(f), "-resize", "780x>", "-quality", "82", str(WEB / "public/shots/phone" / f"{stem[:-6]}.webp")], check=True)
        else:
            subprocess.run(["magick", str(f), "-resize", "1600x>", "-quality", "80", str(WEB / "public/shots/wide" / f"{stem.removesuffix('-desktop')}.webp")], check=True)
    sizes = {}
    for kind in ("phone", "wide"):
        for f in sorted((WEB / "public/shots" / kind).glob("*.webp")):
            w, h = subprocess.run(["magick", "identify", "-format", "%w %h", str(f)], capture_output=True, text=True, check=True).stdout.split()
            sizes[f"{kind}/{f.stem}"] = {"width": int(w), "height": int(h)}
    (WEB / "lib/shots.json").write_text(json.dumps(sizes, indent=2) + "\n")


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "public"
    if which == "convert":
        convert(Path(sys.argv[2]))
        return
    only = set(sys.argv[2:])
    tmp = Path(tempfile.mkdtemp(prefix="teire-shots-"))
    with sync_playwright() as p:
        browser = launch(p)
        for name, path, devices, action in DOCS:
            if only and name not in only:
                continue
            for d in devices:
                shoot(browser, path, DESKTOP if d == "desktop" else PHONE, "light", action, str(tmp / f"{name}-{d}.png"))
                print("docs", name, d)
        browser.close()
    convert(tmp)
    print("captured into", tmp)


if __name__ == "__main__":
    main()
