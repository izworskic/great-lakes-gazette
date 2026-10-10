# Great Lakes Gazette daily data

This branch is the independently versioned publication database. GitHub Actions writes one vetted JSON edition per Michigan calendar day to `data/issues/YYYY-MM-DD.json` and updates `data/index.json`. Public Vercel routes only read the snapshots with caching. Do not commit credentials or unpublished drafts.

The historical Upstash archive is retained separately; this branch begins with new editions and does not claim to contain legacy issues.
