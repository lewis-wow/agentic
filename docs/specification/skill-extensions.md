# Skill Extensions

Skills under `.agents/skills/` (symlinked into `.claude/skills/`) are installed from an external source — never edit them directly, per the rule in [AGENTS.md](../../AGENTS.md). This file is where repo-specific rules that extend or layer onto a skill's behavior live instead, one section per skill. Before running a skill listed here, apply its extension rules on top of the skill's own instructions.

## `/grill-with-docs`

After the grilling session concludes and the resulting ADR/glossary doc changes are written, commit just those doc changes. Use a commit message prefixed `CLAUDE(adr): {message}` instead of the repo's default `CLAUDE: ` prefix, so ADR-only commits are distinguishable in history.
