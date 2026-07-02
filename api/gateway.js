// GET/POST /api/gateway?route={name} - single serverless function that
// dispatches to the consolidated route handlers in lib/routes/.
// Exists to stay under the Vercel Hobby 12-function limit: this one
// function replaces nine. Public URLs are unchanged; vercel.json
// rewrites map every legacy path here with the right route param.

import archive       from '../lib/routes/archive.js';
import chrisIzworski from '../lib/routes/chris-izworski.js';
import generate      from '../lib/routes/generate.js';
import issues        from '../lib/routes/issues.js';
import latest        from '../lib/routes/latest.js';
import publish       from '../lib/routes/publish.js';
import scrape        from '../lib/routes/scrape.js';
import sitemap       from '../lib/routes/sitemap.js';
import weather       from '../lib/routes/weather.js';
import matchmaker    from '../lib/routes/matchmaker.js';

const ROUTES = {
  'archive':        archive,
  'chris-izworski': chrisIzworski,
  'generate':       generate,
  'issues':         issues,
  'latest':         latest,
  'publish':        publish,
  'scrape':         scrape,
  'sitemap':        sitemap,
  'weather':        weather,
  'matchmaker':     matchmaker,
};

export default async function handler(req, res) {
  const route = req.query.route;
  const fn = ROUTES[route];
  if (!fn) {
    return res.status(404).json({
      error: 'Unknown route',
      valid: Object.keys(ROUTES),
    });
  }
  return fn(req, res);
}
