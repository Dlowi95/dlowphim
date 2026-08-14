---
trigger: always_on
description: Enforces the DlowPhim production workflow for every code change in this workspace.
---

# DlowPhim workflow gate

For every request that may modify code, configuration, tests, dependencies, or documentation:

1. Use the workspace skill `dlowphim-production-workflow` before planning or editing.
2. Read `docs/RESPONSIVE_UI_CONVENTIONS.md`, the relevant section of `docs/RESPONSIVE_ARCHITECTURE_AUDIT.md`, and `.agents/AGENTS.md`.
3. State the objective, allowed scope, frozen scope, current data/API/socket owner, and required verification before making changes.
4. Preserve desktop when the task is mobile-only. Never mount duplicate heavy responsive views or create a second data/socket owner.
5. Do not commit, push, deploy, install dependencies, migrate databases, edit secrets, reset Git, or delete user data without explicit approval.
6. Finish with the skill's supervisor handoff format and truthful verification status.

Use GitNexus as read-only code intelligence before broad changes: query the relevant concept, inspect exact symbol context, and check upstream impact. GitNexus never overrides the project contracts or runtime evidence. Do not run GitNexus `setup`, install hooks/skills, enable embeddings, upgrade the pinned package, or treat a `LOW` impact result as proof of safety.

If these requirements conflict with a task brief, stop and request clarification instead of bypassing the rule.

## Delegated Antigravity worker protocol

When Antigravity is delegated a bounded task, it acts as a worker under supervisor review, not as the architecture or release owner.

1. Default to a read-only audit. Implementation requires a separate explicit brief naming every file allowed to change.
2. Stop and report when the smallest safe fix needs a file, dependency, API contract, socket owner, desktop branch, or feature outside the allowed scope.
3. Never run `git checkout`, `git restore`, `git reset`, `git clean`, `git stash`, commit, push, or deploy. Never edit `docs/RESPONSIVE_ARCHITECTURE_AUDIT.md`; only the supervisor records verified status.
4. Player/HLS/embed/failover work under `/watch/[slug]` and realtime room synchronization under `/watch-together/**` remain supervisor-owned unless a later brief explicitly overrides this protection.
5. Do not declare `Đạt` when any required evidence is missing, inferred, `Not found`, or `UNVERIFIED`. Separate measured runtime facts from source-based reasoning.
6. Keep the handoff concise. Do not paste full source, full diffs, repeated project rules, chronological tool logs, or verbose build output.

Write handoff artifacts to the ignored workspace location:

```text
.codex-logs/anti-handoffs/<task-name>.md
.codex-logs/anti-handoffs/<task-name>.runtime.json
```

The Markdown handoff should normally stay within 120 lines and contain only:

```markdown
# Task handoff
## Scope
## Files changed
## Data/API/socket ownership
## Runtime evidence
## Verification
## Remaining risks
## Verdict
```

Store detailed machine-readable viewport, request, image, socket, overflow, and console measurements in the JSON artifact. The Markdown report references that file and summarizes only decision-relevant numbers. The supervisor independently checks `git status`, `git diff`, source, tests, and build before accepting the verdict.
