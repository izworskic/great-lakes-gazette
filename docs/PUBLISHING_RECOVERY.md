# Gazette publishing recovery — September 20, 2026

## Observed outage

The public `/api/latest` feed returned the September 17 edition on September 20.
GitHub scheduled run 35447233873 started normally on September 19 and failed with
HTTP 500 after four editorial revisions. Its critic repeatedly rejected vessel
facts as absent from the source context.

The writer received the complete `buildContext` output. The critic received only
its first 9,000 characters. The September 17 stored payload reconstructs to 21,711
characters; later AIS corridors, news, levels and forecasts were omitted from the
critic's evidence. Publication quality gates are retained; the fix gives both
models identical source evidence. Missing source context still fails closed.
A draft scoring 90 with insufficient grounding now continues revising instead of
ending the loop without an accepted edition.

## Distribution

`/api/latest` feeds all shared `gazette-latest.js` cards on the main site. The
main-site fix refreshes cards every five minutes while visible and when a tab
returns to view, with a 15-second timeout. Delayed and unavailable feeds receive
explicit labels. The Gazette home page dates archived forecasts and discloses a
delayed issue. Feed and home CDN freshness are reduced to 60 seconds with at most
120 seconds of stale-while-revalidate, rather than 600/3600 seconds.

## Release checks

1. Merge the Gazette and main-site fixes after owner approval.
2. Confirm production deploys the reviewed commits.
3. Run Daily Gazette Edition via workflow_dispatch or rerun its failed publish
   job. The existing workflow calls the direct Vercel API host with its stored
   secret; do not put the secret in source, issue bodies or logs.
4. Require a successful publish plus `node scripts/verify-live-edition.mjs`.
5. Confirm the date/headline agree across Gazette home, `/api/latest`, the dated
   issue and the Soo Locks, Gazette landing, home, Great Lakes hub, tracker,
   Mackinac Bridge and Freighter View Farms identity cards.
6. Check the next scheduled run. A successful manual recovery alone is not proof
   that the next scheduled edition has published.

Do not bypass editorial or source-health gates, replace missing sources with
invented facts, or relabel an old edition as today's edition to turn checks green.
