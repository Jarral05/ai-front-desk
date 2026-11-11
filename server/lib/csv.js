// CSV for the owner's lead download, safe to open in Excel, Google Sheets or LibreOffice.
//
// Spreadsheet formula injection (OWASP "CSV Injection"): a cell that starts with = + - @, or with a
// tab, carriage return or line feed, or their full-width forms, can run as a formula when the file
// is opened. A visitor could type "=HYPERLINK(...)" as their name. OWASP's fix, used here: wrap
// every cell in double quotes, double any quote inside, and put a ' in front of risky cells so the
// spreadsheet shows them as text.
const RISKY_START = /^[\s　]*[=+\-@＝＋－＠]|^[\t\r\n]/;

export function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (RISKY_START.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

// The byte order mark at the start tells Excel the file is UTF-8, so names like "Zoë" show right.
export function toCsv(rows) {
  return `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
