# Project Improvement Backlog

Status legend: Priority (P1 critical, P2 important, P3 nice-to-have), Effort (S < 2h, M 2-6h, L > 1 day)

## Guiding Principles

- Keep server single-purpose and fast
- Maintain cross-platform aspiration while keeping macOS-first script stable
- Prefer Bun-native APIs
- Add value incrementally; each task should be independently mergeable

## 1. Reliability & Robustness

- [x] P1 S Export helper `runScreenshot(appName)` in `src/` and refactor tests to import it (no behavior change).
- [x] P1 S Add 15s timeout wrapper around `Bun.spawn`; kill process & return `[TIMEOUT]` error code on exceed.
- [x] P1 S Sanitize/escape `appName` (no shell interpolation) by passing as separate arg; add special char test.
- [x] P1 S Platform guard: if `process.platform !== 'darwin'` return isError with clear "macOS only" message.
- [x] P2 S After capture, `existsSync(path)` verify file; if missing, return warning message instead of success.
- [ ] P2 S Introduce error code tagging `[NOT_FOUND]`, `[PERMISSION]`, `[PARSE]`, `[TIMEOUT]` in responses.
- [ ] P2 M Enhance script output parsing: map NOT_FOUND vs PERMISSION vs GENERIC for guidance.

Acceptance hints: All new error codes documented; tests cover timeout + non-darwin guard + sanitization.

## 2. Performance

- [x] P3 S Measure current bundled size & cold start time; record in README Performance section.
- [x] P3 M Benchmark multiple sequential vs parallel captures (doc results & any limits).
- [x] P3 S Add optional `COMPRESS=1` path invoking `sips -s formatOptions 100` to shrink PNG; verify output.

Acceptance hints: README gains performance table; compression flag documented & tested for existence.

## 3. Features & Extensibility

- [ ] P1 M Implement `list_running_apps` tool (returns JSON array of visible process names); add tests.
- [ ] P2 S Extend screenshot tool schema with `format` (enum: ['png']); reject others gracefully.
- [ ] P2 M Add `windowStrategy` param (auto|id|bounds|interactive) driving script behavior & docs update.
- [ ] P2 M Implement `capture_region` tool with zod (x,y,w,h positive ints); validate ranges.
- [ ] P3 M Optional `returnData:true` to base64 encode PNG (size gate ~1MB) instead of path; test path & data modes.

Acceptance hints: README lists new tools/params; tests cover invalid format, rate limit, region validation.

## 4. Cross-Platform Strategy

- [x] P1 M Create `src/platform.ts` exporting `isMac`, `supportsScreenshots`, placeholders for linux/windows.
- [x] P3 M Add README Linux stub section (grim/slurp instructions) with TODO markers.
- [x] P3 M Add Windows feasibility doc section (PowerShell approaches, limitations) in README.

Acceptance hints: Server imports platform module; non-mac path returns explicit unsupported message.

## 5. Testing & QA

- [ ] P1 S Refactor tests to import new `runScreenshot` helper.
- [ ] P1 M Add timeout simulation test (mock long-running spawn) asserting `[TIMEOUT]` error.
- [ ] P1 S Add platform guard test simulating non-darwin.
- [ ] P2 S Snapshot test for tool metadata (name, title, schema keys).
- [ ] P2 M Parse-fail test (mock stdout without path) asserts fallback message.
- [ ] P2 S Integrate coverage (c8) producing report + README badge placeholder.
- [ ] P2 M Add GitHub Actions macOS workflow (lint, typecheck, test, coverage upload artifact).
- [ ] P3 S Add pre-commit hook script running biome + typecheck.

Acceptance hints: CI passes; coverage threshold configurable; snapshots stable.

## 6. Documentation

- [ ] P1 S Add Architecture section (diagram + flow: request -> spawn -> parse -> response).
- [ ] P1 S Add Error Codes table for all tagged codes.
- [ ] P2 S Create `CONTRIBUTING.md` with setup, QA script, commit style.
- [ ] P2 S Create `CHANGELOG.md` (Keep a Changelog) and backfill 1.0.0.
- [ ] P3 S Security note (local automation scope, no remote execution) in README.
- [ ] P3 S Roadmap section linking to `docs/todo.md`.

Acceptance hints: All links working; new docs lint clean.

## 7. Tooling & DevEx

- [x] P1 S Add `qa` script running lint, typecheck, test sequentially.
- [x] P2 S Pin exact `zod` version (remove caret) & update lock.
- [x] P3 S Add `.editorconfig` mirroring Biome settings.
- [x] P3 S Enable import sorting in Biome config (if desired) & reformat.
- [x] P3 S Add `renovate.json` with basic schedule & dependency groups.

Acceptance hints: `bun run qa` passes; renovate config valid JSON.

## 8. Observability

- [ ] P2 M Add JSON logging mode (env LOG_FORMAT=json) using structured objects.
- [ ] P3 M Maintain in-memory counters {capturesSuccess, capturesError}; expose via `stats` tool.

Acceptance hints: Logs parse as JSON; stats tool returns counts.

## 9. Security & Safety

- [x] P1 S Add zod max length 100 to `appName` schema + failing test for >100.
- [x] P1 S Add test ensuring special characters not executed (literal screenshot attempt).
- [ ] P2 S Add `SECURITY.md` with disclosure process & scope.
- [ ] P3 M Implement optional `ALLOWED_APPS` (CSV) allowlist check before spawn.

Acceptance hints: Disallowed app returns `[NOT_ALLOWED]` error.

## 10. Distribution

- [ ] P2 S Add README section: binary build command + artifact size.
- [ ] P2 M Add package metadata (keywords, repository, license badge) for npm readiness.
- [ ] P3 S Add version & license badges to README header.

Acceptance hints: `npm pack` (dry) works; README shows badges.

## Triage Queue (Evaluate Before Implementing)

- Native Swift helper for window capture precision (investigate APIs)
- Replace AppleScript parsing with `osascript -e` minimal calls for speed
- Add concurrency control for simultaneous captures (queue)

## Suggested Implementation Order (First 5)

1. Reliability P1 set (helper export, timeout, platform guard, sanitization, length limit)
2. Testing alignment (refactor tests, macOS guard test, special char test)
3. Feature: list_running_apps tool
4. Docs: README architecture + error codes + CONTRIBUTING
5. CI workflow + coverage

## Contribution Workflow Checklist

1. Fork & branch: `feat|fix|docs/<slug>`
2. Implement task (keep diff minimal)
3. Run: `bun run qa` (add this script first if missing)
4. Update docs & changelog
5. Open PR referencing task section header
6. Ensure CI green before merge

---
Generated: 2025-08-14
