// GET /sitemap.xml — dynamic sitemap so lastmod always reflects today
// Google uses lastmod to decide recrawl frequency — daily update = daily crawl

export default function handler(req, res) {
  const today = new Date().toISOString().slice(0, 10);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://great-lakes-gazette.vercel.app</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <news:news>
      <news:publication>
        <news:name>Great Lakes Gazette</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${today}</news:publication_date>
      <news:title>Great Lakes Gazette — Daily Maritime News from the Fleet</news:title>
    </news:news>
  </url>
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
  return res.status(200).send(xml);
}
