import { esc, stripDashes } from './layout.js';

export function renderNewsMetadata(date, issue, today) {
  const publicationDate = new Date(`${date}T00:00:00Z`);
  const currentDate = new Date(`${today}T00:00:00Z`);
  const ageInDays = Math.floor((currentDate - publicationDate) / 86400000);
  if (ageInDays < 0 || ageInDays > 1) return '';

  const headline = issue && issue.brief && issue.brief.headline;
  if (!headline) return '';

  return `
    <news:news>
      <news:publication>
        <news:name>Great Lakes Gazette</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${date}</news:publication_date>
      <news:title>${esc(stripDashes(headline))}</news:title>
    </news:news>`;
}
