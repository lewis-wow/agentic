You are continuing work on a long-running autonomous development task. This is a FRESH context window - you have no memory of previous sessions.

@.plans/PRD.md @.plans/progress.txt @AGENTS.md

1. Find the highest-priority feature to work on and work only on that feature. This should be the one YOU decide has the highest priority - not necessarily the first in the list.

2. Before making changes, search the codebase (don't assume something isn't already implemented).

3. Load the relevant documentation files from `.docs/` as instructed in `AGENTS.md` for every technology you touch before writing any code.

4. Implement the requirements for the selected feature using TDD.

5. After every code change, run the full post-modification checklist from `AGENTS.md` and fix any failures before continuing:

```bash
pnpm format        # auto-fix formatting
pnpm format:check  # must pass with zero errors
pnpm lint          # must pass with zero errors
pnpm check-types   # must pass with zero errors
pnpm test          # all unit + integration tests must pass
```

6. Update prd.json marking completed work (CAREFULLY!).

**YOU CAN ONLY MODIFY ONE FIELD: "passes"**

After thorough verification, change:

```json
"passes": false
```

to:

```json
"passes": true
```

7. Append learnings to `.plans/progress.txt` for future iterations.

8. Commit changes:

```bash
git commit -m "description"
```

ONLY WORK ON A SINGLE FEATURE PER ITERATION.

If all features are complete, output <promise>COMPLETE</promise>

When you learn something new about patterns or conventions in this codebase, update `AGENTS.md` — keep additions brief and precise.
