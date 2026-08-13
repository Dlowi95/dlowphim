---
name: dlowphim-production-workflow
description: Implements, fixes, refactors, or optimizes DlowPhim frontend and backend tasks under strict responsive, data-owner, regression, and production-verification rules. Use for any code change in the DlowPhim workspace, especially mobile/desktop UI, API, image, socket, performance, or route optimization work.
---

# DlowPhim Production Workflow

Act as an implementation worker. Respect the task brief and return evidence for a supervisor to review. Do not broaden scope or declare success from visual inspection alone.

## Read project contracts

Before planning or editing:

1. Read `docs/RESPONSIVE_UI_CONVENTIONS.md` completely.
2. Read the relevant route status in `docs/RESPONSIVE_ARCHITECTURE_AUDIT.md` completely.
3. Read `.agents/AGENTS.md` and follow repository instructions.
4. Inspect existing changes with `git status --short` and preserve unrelated user work.

Treat these files as authoritative. Do not duplicate their full contents in the task response.

## Confirm the task boundary

Extract and state:

- objective;
- files/features allowed to change;
- files/features frozen by the request;
- current data, state, API, and socket owner;
- verification required for completion.

If the brief says mobile-only, freeze desktop markup and styling. Create or update a mobile component when structure differs. Never patch mobile through a global selector that can affect desktop.

If scope is ambiguous and a choice would materially change architecture or desktop behavior, stop and request direction. Do not guess.

## Inspect before editing

Gather evidence before proposing a fix:

1. Use GitNexus read-only tools to query the feature, inspect exact controller/view symbols, and check upstream impact before a broad edit.
2. Confirm GitNexus points to repository alias `dlowphim` and reports the index as current; if stale, report it instead of relying on old graph results.
3. Locate the controller, views, hooks, API clients, caches, sockets, and fallbacks in the source itself.
4. Check whether mobile and desktop mount simultaneously.
5. Trace each request and realtime connection to one owner.
6. Check loading, error, empty, reload, cleanup, and stale-response behavior.
7. Establish the smallest change that fixes the demonstrated issue.

GitNexus is navigation evidence, not runtime proof. Its React entry-point impact analysis may omit framework or render relationships. Never use a `LOW` or zero-impact result to skip DOM, network, socket, breakpoint, test, or build verification. Do not run GitNexus `setup`, install its hooks or skills, enable embeddings, or upgrade the pinned package without explicit supervisor approval.

Do not rewrite working code for stylistic preference. Do not add a second API call, cache, timer, observer, listener, or socket to make a separate view work.

## Implement safely

- Keep business state and handlers in one controller/owner.
- Keep responsive views presentational and pass data through props.
- Mount only one heavy responsive view at a time.
- Use dynamic import for large mobile-only views.
- Use CSS breakpoints for small presentational differences only.
- Preserve fixed image aspect ratios and use the local movie fallback.
- Abort or invalidate stale requests and clean up effects on unmount.
- Preserve current desktop behavior unless desktop is explicitly in scope.
- Avoid new dependencies unless the supervisor approves them.
- Never delete user data, reset Git state, commit, push, deploy, migrate a database, or edit secrets without explicit approval.

## Verify proportionally

For every changed route, collect evidence required by the responsive contract:

- DOM and lifecycle;
- API ownership and duplicate requests;
- visible images and reload behavior;
- socket/listener count and cleanup;
- overflow, modal, fixed navigation, and interaction behavior;
- breakpoint behavior and desktop regression.

For layout-wide changes, check `360`, `390`, `440`, `767`, `768`, `1024`, `1440`, and `1920px`. For a localized change, check all affected breakpoints plus the `767/768px` boundary.

Always run:

```text
cd frontend
npx tsc --noEmit
npm run test:watch
npm run build
```

Run relevant backend checks when backend code changes. Do not weaken or remove tests to make validation pass.

Do not perform destructive UI operations against real account data. Test confirmation flows by opening and cancelling unless deletion is explicitly authorized.

## Update audit status

Update `docs/RESPONSIVE_ARCHITECTURE_AUDIT.md` only when runtime evidence supports the status.

- Use `Đạt` only when every required group was verified.
- Use `Đạt một phần` when evidence is incomplete.
- Record exact breakpoints, datasets, test/build results, and known limitations.
- Never infer that an untested branch is optimized.

## Hand off to the supervisor

Return a concise report with these exact sections:

```markdown
## Scope
## Files changed
## Data/API/socket ownership
## Verification evidence
## Desktop impact
## Unverified or remaining risks
```

Include commands and outcomes, not raw verbose logs. Explicitly say when no desktop file or desktop branch changed. Do not claim the task is complete when any required verification failed or was skipped.
