# Targeting rules use AND semantics, not a configurable operator

A `targeted` flag's rule set requires every rule to match — there is no per-flag choice of AND vs. OR, and no short-circuit change to the result. We considered letting users choose the combining operator per rule set, but rejected it: AND-only keeps evaluation and the rule builder UI simple, and covers the overwhelming majority of real targeting needs (e.g. "beta users AND EU region"). A flag needing OR semantics today is expressed as multiple separate flags instead.
