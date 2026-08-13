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
