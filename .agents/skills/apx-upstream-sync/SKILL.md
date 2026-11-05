---
name: apx-upstream-sync
description: Fork upstream sync for this repository — merging `upstream/main` into the fork, assessing which upstream changes to take, or recording a sync's lessons and pitfalls.
---

# Upstream sync

The procedure, the record format and the known pitfalls live in [`rules/FORK_SYNC.md`](../../../rules/FORK_SYNC.md).
That file is the single source; this skill only routes to it.

1. Read `rules/FORK_SYNC.md` in full before fetching. Done when every Known pitfalls entry has been checked against
   the upstream range.
2. Assess or merge following its steps. When the owner only asks what upstream offers, stop after the comparison and
   report it grouped by feature.
3. Record the sync as `Recording a sync` says: the merge commit body, plus new recurring pitfalls added to
   `Known pitfalls` on the same branch. Done when each conflict is either a commit-body line or a pitfall entry.
