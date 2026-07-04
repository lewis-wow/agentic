# Flag evaluation happens client-side in the SDK

Percentage-rollout and targeting-rule evaluation runs inside the SDK, against a locally cached Flag Snapshot, not server-side per flag check. `apps/api` sends the full flag configuration — including rollout percentage and targeting rules — to the SDK once via the snapshot/SSE stream; the SDK computes `isEnabled()` locally with no network hop per check. This trades a larger snapshot payload, and exposing rule contents to the client, for zero-latency evaluation, which is the SDK's core value proposition.
