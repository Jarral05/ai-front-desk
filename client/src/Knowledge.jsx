import { useEffect, useRef, useState } from 'react';
import { deleteJson, getJson, postJson, putJson, uploadPdf } from './api.js';

const MAX_PDF_BYTES = 2 * 1024 * 1024;
const MAX_SERVICES = 12;

// The boxes hold text while the owner types; numbers are made only when saving.
const toForm = (view) => ({
  services: view.services.map((s) => ({ name: s.name, minutes: String(s.minutes), price: String(s.price) })),
  hours: view.hours.join('\n'),
  facts: view.facts.join('\n'),
  greeting: view.greeting,
});
const lines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);
// An empty or non-number box becomes null, and the server says "Enter ... as a number".
const toNumber = (text) => (text.trim() === '' || Number.isNaN(Number(text)) ? null : Number(text));

// What the AI assistant knows: services and prices, opening hours, facts, the welcome message,
// and one PDF. The server checks everything again and decides what is saved.
export function Knowledge({ onSignedOut }) {
  const [view, setView] = useState(null); // the server's copy
  const [form, setForm] = useState(null); // the owner's edits
  const [fields, setFields] = useState({});
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef(null);

  const show = (next) => {
    setView(next);
    setForm(toForm(next));
    setFields({});
  };

  useEffect(() => {
    getJson('/api/owner/knowledge').then((result) => {
      if (result.status === 401) onSignedOut();
      else if (result.ok) show(result.data);
      else setMessage({ ok: false, text: result.error });
    });
  }, []);

  // Runs one change on the server. True when it worked.
  async function run(action, success) {
    setBusy(true);
    setMessage(null);
    const result = await action();
    setBusy(false);
    if (result.status === 401) {
      onSignedOut();
      return false;
    }
    if (!result.ok) {
      setFields(result.fields || {});
      setMessage({ ok: false, text: result.error });
      return false;
    }
    show(result.data);
    setMessage({ ok: true, text: success });
    return true;
  }

  function save(event) {
    event.preventDefault();
    run(() => putJson('/api/owner/knowledge', {
      services: form.services.map((s) => ({ name: s.name, minutes: toNumber(s.minutes), price: toNumber(s.price) })),
      hours: lines(form.hours),
      facts: lines(form.facts),
      greeting: form.greeting,
    }), 'Saved. The chat uses the new facts from the next message.');
  }

  async function upload() {
    if (file.size > MAX_PDF_BYTES) {
      setMessage({ ok: false, text: 'The PDF can be up to 2 MB.' });
      return;
    }
    if (await run(() => uploadPdf('/api/owner/knowledge/pdf', file), 'PDF added. The chat can answer from it now.')) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function reset() {
    setConfirmReset(false);
    await run(() => postJson('/api/owner/knowledge/reset'), 'Back to the demo facts. The PDF was removed.');
  }

  if (!form) return message ? <p className="notice" role="alert">{message.text}</p> : <p className="quiet">Loading…</p>;

  const setField = (name) => (event) => setForm((f) => ({ ...f, [name]: event.target.value }));
  const setService = (index, key) => (event) => setForm((f) => ({
    ...f,
    services: f.services.map((s, i) => (i === index ? { ...s, [key]: event.target.value } : s)),
  }));
  const addService = () => setForm((f) => ({ ...f, services: [...f.services, { name: '', minutes: '', price: '' }] }));
  const removeService = (index) => setForm((f) => ({ ...f, services: f.services.filter((_, i) => i !== index) }));

  const problem = (name) => fields[name] && <span className="field-error" id={`err-${name}`}>{fields[name]}</span>;
  const marked = (name) => (fields[name] ? { 'aria-invalid': true, 'aria-describedby': `err-${name}` } : {});

  return (
    <>
      <div className="owner-title"><h1>Knowledge</h1></div>
      <p className="quiet">
        What the AI assistant knows. A change counts from the next chat message.{' '}
        {view.isDemo ? 'These are the demo facts.' : 'These are your saved facts.'}
      </p>
      <p className="meter">
        <span><strong>{view.usedChars.toLocaleString()}</strong> of {view.maxChars.toLocaleString()} characters the assistant can know</span>
        <meter min={0} max={view.maxChars} value={view.usedChars} aria-label="Characters used" />
      </p>
      {message && (
        <p className={message.ok ? 'saved' : 'notice'} role={message.ok ? 'status' : 'alert'}>{message.text}</p>
      )}

      <form className="owner-card stack" onSubmit={save} noValidate>
        <fieldset>
          <legend>Services and prices</legend>
          {form.services.map((service, i) => (
            // Rows have no ID of their own; the position is their key while editing.
            // eslint-disable-next-line react/no-array-index-key
            <div className="service-row" key={i}>
              <label>Name
                <input value={service.name} maxLength={60} onChange={setService(i, 'name')} {...marked(`services.${i}.name`)} />
                {problem(`services.${i}.name`)}
              </label>
              <label>Minutes
                <input inputMode="numeric" value={service.minutes} maxLength={4} onChange={setService(i, 'minutes')} {...marked(`services.${i}.minutes`)} />
                {problem(`services.${i}.minutes`)}
              </label>
              <label>Price ($)
                <input inputMode="numeric" value={service.price} maxLength={6} onChange={setService(i, 'price')} {...marked(`services.${i}.price`)} />
                {problem(`services.${i}.price`)}
              </label>
              <button type="button" className="button-quiet" onClick={() => removeService(i)}
                disabled={form.services.length === 1} aria-label={`Remove ${service.name || 'this service'}`}>
                Remove
              </button>
            </div>
          ))}
          {problem('services')}
          <div>
            <button type="button" className="button-quiet" onClick={addService} disabled={form.services.length >= MAX_SERVICES}>
              + Add a service
            </button>
          </div>
        </fieldset>

        <label><span>Opening hours <span className="optional">(one per line)</span></span>
          <textarea rows={4} value={form.hours} onChange={setField('hours')} {...marked('hours')} />
          {problem('hours')}
        </label>
        <label><span>Good to know <span className="optional">(one fact per line)</span></span>
          <textarea rows={7} value={form.facts} onChange={setField('facts')} {...marked('facts')} />
          {problem('facts')}
        </label>
        <label>Welcome message
          <textarea rows={3} maxLength={400} value={form.greeting} onChange={setField('greeting')} {...marked('greeting')} />
          {problem('greeting')}
        </label>
        <p className="quiet small">Always added after your welcome, so visitors know who they're talking to: “{view.notice}”</p>
        <div><button type="submit" className="button" disabled={busy}>Save facts</button></div>
      </form>

      <section className="owner-card stack" aria-labelledby="pdf-title">
        <h2 id="pdf-title">A PDF the assistant can read</h2>
        <p className="quiet">
          One PDF, such as a price list or FAQ: up to 2 MB and 20 pages. The assistant reads its text; the file itself isn't kept.
          A new PDF replaces the old one.
        </p>
        {view.pdf ? (
          <div>
            <p><strong>{view.pdf.name}</strong> · {view.pdf.pages} {view.pdf.pages === 1 ? 'page' : 'pages'} · {view.pdf.chars.toLocaleString()} characters</p>
            <details>
              <summary>What the assistant read</summary>
              <pre className="pdf-text">{view.pdf.text}</pre>
            </details>
            <button type="button" className="button-quiet" disabled={busy}
              onClick={() => run(() => deleteJson('/api/owner/knowledge/pdf'), 'PDF removed.')}>
              Remove PDF
            </button>
          </div>
        ) : <p>No PDF yet.</p>}
        <div className="upload-row">
          <label>{view.pdf ? 'Replace it with' : 'Choose a PDF'}
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files[0] ?? null)} />
          </label>
          <button type="button" className="button" disabled={!file || busy} onClick={upload}>Upload</button>
        </div>
      </section>

      <section className="owner-card stack" aria-labelledby="reset-title">
        <h2 id="reset-title">Start again</h2>
        <p className="quiet">Puts back the demo services, hours, facts and welcome, and removes the PDF.</p>
        {confirmReset ? (
          <div className="confirm" role="group" aria-label="Confirm the reset">
            <p>Replace everything with the demo facts?</p>
            <button type="button" className="button button-danger" disabled={busy} onClick={reset}>Yes, reset</button>
            <button type="button" className="button-quiet" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        ) : (
          <div><button type="button" className="button-quiet" onClick={() => setConfirmReset(true)}>Reset to demo facts</button></div>
        )}
      </section>
    </>
  );
}
