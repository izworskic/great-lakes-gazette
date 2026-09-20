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

## Verified second failure and recovery format

After the evidence-parity repair deployed, recovery job 106069626839 still failed
on September 20. This time the critic correctly identified confused report dates
and positions rather than missing evidence. Narrative revisions alone cannot be
the sole publication path.

`lib/source-bulletin.js` provides a distinct fallback publication format. It copies
only typed, dated source fields, explicitly labels report times and unconfirmed
ETAs, keeps station datums and timestamps, and discloses why the narrative is
unavailable. It never reuses rejected prose or assigns a fabricated quality score.
It requires five AIS source fetches within an hour, three NOAA observations from
today/yesterday, and three NWS forecasts issued within 36 hours, in addition to the
normal publication/date gates. Missing or stale sources still block publication.
Narrative requests and retries are bounded so fallback storage fits the function
budget. A successful source bulletin counts as that day's edition; retries do not
silently replace it or create duplicate drafts.

The live browser also retained the old main-site script under its four-hour asset
cache. The companion cache-version change updates all seven script references so
returning visitors receive the repaired refresh behavior immediately.
