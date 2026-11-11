// Makes small, real PDF files for the tests, so no binary files live in the repo.
// Each string in `pages` becomes one page; "\n" starts a new line. Plain ASCII only.
// Keep to about 44 lines a page: PDF.js only reads text that sits on the page (measured 11 Nov:
// 250 lines on one page gave back the first 46).
//
// A PDF is a list of numbered objects (catalog, page list, font, pages, page contents),
// then a table ("xref") of where each object starts in the file, counted in bytes.
export function makePdf(pages) {
  const objects = [];
  const add = (body) => objects.push(body); // returns the new object's number

  const catalog = add('');
  const pageList = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const kids = pages.map((text) => {
    const lines = String(text).split('\n').filter(Boolean);
    const stream = [
      'BT', '/F1 12 Tf', '16 TL', '72 720 Td',
      ...lines.map((line) => `(${line.replace(/[\\()]/g, '\\$&')}) Tj T*`),
      'ET',
    ].join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    return add(`<< /Type /Page /Parent ${pageList} 0 R /MediaBox [0 0 612 792] `
      + `/Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);
  });

  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pageList} 0 R >>`;
  objects[pageList - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let file = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const at = Buffer.byteLength(file, 'latin1');
    file += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xrefAt = Buffer.byteLength(file, 'latin1');
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  file += offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('');
  file += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(file, 'latin1');
}
