// Reads the text out of the owner's PDF with unpdf (a build of Mozilla's PDF.js, decision 0005).
// Only the text is kept; the file itself is never saved.
//
// unpdf's README names the limits that are the app's job, and each one is here: the real file type
// is checked from its first bytes, images are capped, the page count is checked before any text is
// read, and the whole read races a timeout.
import { extractText, getDocumentProxy } from 'unpdf';
import { LIMITS } from '../config.js';
import { HttpError } from '../errors.js';

// Every PDF starts with these five bytes. A renamed .exe or .txt fails here, whatever its name.
const PDF_START = Buffer.from('%PDF-');

export function isPdf(data) {
  return Buffer.isBuffer(data) && data.subarray(0, PDF_START.length).equals(PDF_START);
}

// Keeps line breaks, turns every other kind of space into one space, drops invisible control
// characters and leaves at most one empty line in a row.
export function tidyText(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('PDF read timed out'), { name: 'TimeoutError' })), ms);
  });
  // Promise.race also listens to the slower promise, so if the read fails after the timeout has
  // already answered, that late failure is handled and can't crash the server.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Turns what went wrong into words the owner can act on.
export function pdfProblem(error) {
  if (error instanceof HttpError) return error;
  if (error?.name === 'PasswordException') {
    return new HttpError(400, 'This PDF is password-protected. Remove the password and upload it again.');
  }
  if (error?.name === 'TimeoutError') {
    return new HttpError(400, 'This PDF took too long to read. Try a shorter or simpler file.');
  }
  return new HttpError(400, "This file couldn't be read as a PDF. Try saving it as a PDF again.");
}

// Returns { pages, text }, or throws an HttpError with words the owner can act on.
export async function readPdfText(data) {
  if (!Buffer.isBuffer(data) || data.length === 0) throw new HttpError(400, 'Choose a PDF file first.');
  if (!isPdf(data)) throw new HttpError(415, 'Only PDF files can be uploaded, and the file must really be one.');

  let pdf;
  const read = (async () => {
    pdf = await getDocumentProxy(new Uint8Array(data), {
      isEvalSupported: false, // never build code from the file's contents
      maxImageSize: 16_777_216, // about 16 megapixels, so one image can't claim gigabytes
      disableFontFace: true,
      verbosity: 0, // errors only; PDF.js warnings don't belong in the server log
    });
    if (pdf.numPages > LIMITS.pdfPages) {
      throw new HttpError(400, `This PDF has ${pdf.numPages} pages. The limit is ${LIMITS.pdfPages}.`);
    }
    const { text } = await extractText(pdf, { mergePages: true });
    return { pages: pdf.numPages, text: tidyText(text) };
  })();

  try {
    return await withTimeout(read, LIMITS.pdfTimeoutMs);
  } catch (error) {
    throw pdfProblem(error);
  } finally {
    // Frees the parsed file. In PDF.js 6 the loading task owns destroy(); the document doesn't.
    pdf?.loadingTask.destroy().catch(() => {});
  }
}
