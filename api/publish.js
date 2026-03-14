// POST /api/publish — receives generated brief text, publishes to WordPress
// Body: { brief, issueDate, issueNumber, sources }
const WP_SITE_ID = '236609682';
const WP_TOKEN   = 'ack4zf(mejvyITGg&Jh8jbEM4egtsn)Svz8Y@raObtjHQ4k!dWIfDnr53aK#iXmy';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { brief, issueDate, issueNumber, sources } = req.body || {};
    if (!brief) return res.status(400).json({ error: 'brief is required' });

    const title = `Great Lakes Gazette — Issue ${issueNumber || 1} — ${issueDate || new Date().toLocaleDateString()}`;

    const sourceLinks = [];
    (sources?.portReports || []).forEach(p =>
      p.url && sourceLinks.push(`<a href="${p.url}" target="_blank">${p.title || 'Port Report'}</a>`)
    );
    (sources?.newsItems || []).slice(0, 2).forEach(n =>
      n.url && sourceLinks.push(`<a href="${n.url}" target="_blank">${n.title || 'News'}</a>`)
    );
    const aisNote = sources?.aisPassages?.length > 0
      ? `Live AIS: ${sources.aisPassages.map(p => `${p.port} (${p.count})`).join(', ')}.`
      : 'AIS live passage data not available this issue (off-season).';

    const bodyHtml = brief
      .split('\n\n').filter(p => p.trim())
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')
    + `<hr><p style="font-size:.82em;color:#666">`
    + (sourceLinks.length ? `<strong>Sources:</strong> ${sourceLinks.join(' · ')}<br>` : '')
    + `${aisNote} All facts sourced from live data — nothing is invented.</p>`;

    const r = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${WP_SITE_ID}/posts/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title, content: bodyHtml, status: 'draft',
        tags: ['great lakes','shipping','freighters','maritime','gazette'],
      })
    });
    if (!r.ok) throw new Error(`WP ${r.status}: ${(await r.text()).slice(0,200)}`);
    const result = await r.json();
    return res.status(200).json({
      success: true,
      post_id: result.ID,
      url: result.URL,
      edit_url: `https://wordpress.com/post/freighterviewfarms.com/${result.ID}`,
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
