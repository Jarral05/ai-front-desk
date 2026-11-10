// An error with an HTTP status the browser may see. Anything else becomes a plain 500.
export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields; // optional: { fieldName: 'what to fix' } for forms
  }
}
