# Skill Extensions

Skills under `.agents/skills/` (symlinked into `.claude/skills/`) are installed from an external source — never edit them directly, per the rule in [AGENTS.md](../../AGENTS.md). This file is where repo-specific rules that extend or layer onto a skill's behavior live instead, one section per skill. Before running a skill listed here, apply its extension rules on top of the skill's own instructions.

## `/grill-with-docs`

After the grilling session concludes and the resulting ADR/glossary doc changes are written, commit just those doc changes. Use a commit message prefixed `CLAUDE(adr): {message}` instead of the repo's default `CLAUDE: ` prefix, so ADR-only commits are distinguishable in history.

## `/to-spec`

A spec is a parent issue, not something meant to be implemented directly — the whole spec is too large to land as one change. Apply the `spec` label to it (in addition to, not instead of, whatever the skill's own instructions already say). Do not apply `ready-for-agent` to a spec issue — that label means "grabbable and implementable as-is," which a spec is not until `/to-tickets` has broken it down.

## `/to-tickets`

Each ticket produced from a spec must be small enough to implement as one self-contained unit of work — that's the whole reason the spec gets broken down instead of implemented directly. Tickets reference the spec issue as their parent (per the skill's own issue template) but carry no extra marker beyond what the skill already applies (`ready-for-agent`) — the `spec` label belongs only on the parent, never on its tickets.
