# Skill Extensions

Skills under `.agents/skills/` (symlinked into `.claude/skills/`) are installed from an external source — never edit them directly, per the rule in [AGENTS.md](../../AGENTS.md). This file is where repo-specific rules that extend or layer onto a skill's behavior live instead, one section per skill. Before running a skill listed here, apply its extension rules on top of the skill's own instructions.

## `/grill-with-docs`

After the grilling session concludes and the resulting ADR/glossary doc changes are written, commit just those doc changes. Use a commit message prefixed `CLAUDE(adr): {message}` instead of the repo's default `CLAUDE: ` prefix, so ADR-only commits are distinguishable in history.

## `/to-spec`

A spec is a parent issue, not something meant to be implemented directly — the whole spec is too large to land as one change. Apply the `spec` label to it (in addition to, not instead of, whatever the skill's own instructions already say). Do not apply `ready-for-agent` to a spec issue — that label means "grabbable and implementable as-is," which a spec is not until `/to-tickets` has broken it down.

## `/to-tickets`

Each ticket produced from a spec must be small enough to implement as one self-contained unit of work — that's the whole reason the spec gets broken down instead of implemented directly. Tickets reference the spec issue as their parent (per the skill's own issue template) but carry no extra marker beyond what the skill already applies (`ready-for-agent`) — the `spec` label belongs only on the parent, never on its tickets.

## `/implement`

Scope: applies only to spec issues (labeled `spec`) and their child tickets (labeled `ready-for-agent`, with a `## Parent` link to a spec) — issues that came through the `/to-spec` → `/to-tickets` pipeline. Work on any other `#<int>` issue reference still follows AGENTS.md's direct-to-master commit → push → comment flow; do not branch/PR for those.

For pipeline work, never commit straight to `master`. Instead:

- **Spec branch**: the first time any of a spec's tickets is implemented, create a branch off `master` named `spec/<issue-number>-<slug>` (e.g. `spec/10-jwt-verified-trusted-proxy-identity`) if it doesn't already exist. This is the integration branch every child ticket's PR targets — never push ticket commits straight to it.
- **Ticket branch**: for each ticket, branch off the spec branch (not `master`) named `ticket/<issue-number>-<slug>` (e.g. `ticket/11-jwt-verified-trusted-proxy-for-apps-bff`). Do the ticket's implementation, TDD, and the full post-modification checklist there, exactly as normal — the only change from the non-pipeline flow is the branch and skipping the direct-to-master commit.
- **Ticket PR**: once a ticket is done (checklist green, `/code-review` findings addressed), push the ticket branch and open a PR from it into the _spec branch_ (not `master`). Comment on the ticket issue linking the PR (not a bare commit, since there's no master commit yet), same `CLAUDE: ` prefix convention. Do not merge it yourself — that's the user's review/merge action.
- **Spec PR**: once the spec branch has at least one ticket merged into it (a PR into `master` needs a diff to exist, so this can't happen before that), open a PR from the spec branch into `master`, if one doesn't already exist. Open it as a **draft** — it represents the whole spec and is only meant to be merged once every child ticket has landed in the spec branch, and draft status guards against it being merged early by mistake. Do not mark it ready for review or merge it yourself; the user promotes and merges it once all tickets are in.
- The agent never merges a PR (ticket or spec) — every merge is the user's action, performed on GitHub.
