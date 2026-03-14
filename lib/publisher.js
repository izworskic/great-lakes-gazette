// Publishes generated brief to FVF WordPress as a draft post

const WP_SITE_ID = '236609682';
const WP_TOKEN   = 'ack4zf(mejvyITGg&Jh8jbEM4egtsn)Svz8Y@raObtjHQ4k!dWIfDnr53aK#iXmy';

export async function publishToWordPress(briefData) {
  const { brief, issueDate, issueNumber, sources } = briefData;
  const title = `Great Lakes Gazette — Issue ${issueNumber} — ${issueDate}`;

  // Build source attribution footer
  const sourceLinks = [];
  (sources.portReports || []).forEach(p =>
    sourceLinks.push(`<a href="${p.url}" target="_blank">${p.title}</a>`)
  );
  (sources.newsItems || []).slice(0, 2).forEach(n =>
    sourceLinks.push(`<a href="${n.url}" target="_blank">${n.title}</a>`)
  );

  const aisNote = sources.aisPassages?.length > 0
    ? `Live AIS data: ${sources.aisPassages.map(p => `${p.port} (${p.count} vessels)`).join(', ')}. `
    : 'AIS live passage data not available this issue (off-season or database offline). ';

  const footer = `
<hr>
<p style="font-size:0.82em;color:#666;line-height:1.5">
<strong>Data sources:</strong> ${sourceLinks.join(' · ')}<br>
${aisNote}All vessel movements are sourced from live data — nothing is invented.
</p>`;

  const bodyHtml = brief
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n') + footer;

  const r = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${WP_SITE_ID}/posts/new`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      content: bodyHtml,
      status: 'draft',
      tags: ['great lakes', 'shipping', 'freighters', 'maritime', 'gazette', 'ais'],
      format: 'standard',
    })
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`WordPress API ${r.status}: ${err.slice(0, 300)}`);
  }

  const result = await r.json();
  return {
    post_id:  result.ID,
    url:      result.URL,
    edit_url: `https://wordpress.com/post/freighterviewfarms.com/${result.ID}`,
    status:   result.status,
    title:    result.title,
  };
}
