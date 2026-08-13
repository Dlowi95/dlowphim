# GitNexus + Antigravity runbook for DlowPhim

## Purpose

GitNexus is the read-only code map in the DlowPhim workflow:

```text
Rules + Audit  -> non-negotiable project truth
Skill          -> required working process
GitNexus       -> code relationships and navigation hints
```

It does not replace source inspection, runtime verification, tests, or the responsive architecture audit.

## Approved installation

- Pinned package: `gitnexus@1.6.9`.
- Package installation: `D:\dlowphim\.gitnexus-pilot-tool`.
- Repository index: `D:\dlowphim\.gitnexus`.
- Private registry: `D:\dlowphim\.gitnexus-pilot-tool\registry-main`.
- Antigravity IDE global MCP config: `%USERPROFILE%\.gemini\config\mcp_config.json`.
- `.agents/mcp_config.json` is kept only as the repository reference copy; the current IDE does not auto-load MCP servers from that workspace path.
- Analysis mode: `--index-only`, without embeddings.

The index and tool installation are excluded locally through `.git/info/exclude`. They are machine-local artifacts and must not be committed.

## Required usage

Before a broad code change:

1. Confirm the index is current.
2. Query the feature or execution flow.
3. Inspect exact symbol context.
4. Inspect upstream impact for the proposed symbol.
5. Verify every result against the source and project contracts.

GitNexus can miss Next.js and React render relationships. A `LOW` or zero-impact result is not proof that a change is safe.

## Re-index command

Run only after meaningful source changes or when GitNexus reports the index as stale:

```powershell
$env:GITNEXUS_HOME='D:\dlowphim\.gitnexus-pilot-tool\registry-main'
$env:GITNEXUS_SKIP_OPTIONAL_GRAMMARS='1'
node D:\dlowphim\.gitnexus-pilot-tool\node_modules\gitnexus\dist\cli\index.js analyze D:\dlowphim --index-only --name dlowphim --workers 2 --max-file-size 512
```

Do not run re-indexing for every small edit. The MCP may read a stale graph until the approved command completes.

## Prohibited automatic actions

- Do not run `gitnexus setup`.
- Do not install GitNexus hooks or generated skills.
- Do not enable embeddings.
- Do not use `npx ...@latest` or upgrade the pinned package automatically.
- Do not edit `AGENTS.md`, `.agents`, Git hooks, or Antigravity settings through GitNexus.
- Do not expose the MCP over HTTP; use local stdio only.

Any package upgrade or integration expansion requires a fresh isolated pilot and explicit approval.
