# Flag type is stored per-environment, not per-flag

A flag's type (`boolean`, `percentage_rollout`, `targeted`) lives on `FlagState`, scoped to one environment, rather than once on `Flag` itself. This lets the same flag run as a plain boolean in `production` while being rolled out by percentage in `development`, matching how flags are actually used while a rollout is in progress. The trade-off: a flag has no single "type" you can read without first picking an environment — every UI and API surface that shows type must be environment-scoped.
