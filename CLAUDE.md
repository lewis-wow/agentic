# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Before processing any user request or writing code, you must use your file-reading tool to read the @AGENTS.md file in the root directory.

Follow all core rules and use the documentation file paths specified inside @AGENTS.md to load the necessary technology context.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `lewis-wow/agentic`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context — one root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
