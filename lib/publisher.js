// Publishes the generated brief to FVF WordPress as a draft post
// Uses WordPress.com REST API

const WP_SITE_ID = '236609682';
const WP_TOKEN = 'ack4zf(mejvyITGg&Jh8jbEM4egtsn)Svz8Y@raObtjHQ4k!dWIfDnr53aK#iXmy';

export async function publishToWordPress(briefData) {
  const { brief, issueDate, issueNumber, sources } = briefData;

  const title = `Great Lakes Gazette — Issue ${issueNumber} — ${issueDate}`;

  // Build source attribution footer
  const sourceLinks = [];
  if (sources.portReport) sourceLinks.push(`<a href="${sources.portReport}" target="_blank">BoatNerd Port Report</a>`);
  if (sources.seaway) sourceLinks.push(`<a href="${sources.seaway}" target="_blank">US Seaway</a>`);
  const passageLinks = (sources.passages || [])
    .filter(p => p.count > 0 && p.url)
    .map(p => `<a href="${p.url}" target="_blank">${p.port} (${p.count} vessels)</a>`);

  const footer = `
<hr>
<p style="font-size:0.85em;color:#666;">
<strong>Sources:</strong> ${[...sourceLinks, ...passageLinks].join(' · ')}<br>
This brief was generated automatically from real AIS tracking data. All vessel movements are sourced from live data — nothing is invented.
</p>`;

  // Convert brief text to HTML paragraphs
  const bodyHtml = brief
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n') + footer;

  const payload = {
    title,
    content: bodyHtml,
    status: 'draft', // stays draft so you can review before publishing
    categories: [],
    tags: ['great lakes', 'shipping', 'freighters', 'maritime', 'gazette'],
    format: 'standard',
  };

  const r = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${WP_SITE_ID}/posts/new`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`WordPress API error ${r.status}: ${err}`);
  }

  const result = await r.json();
  return {
    post_id: result.ID,
    url: result.URL,
    edit_url: `https://wordpress.com/post/freighterviewfarms.com/${result.ID}`,
    status: result.status,
    title: result.title
  };
}
