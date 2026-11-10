import { useState } from 'react';
import { postJson } from './api.js';

const TIMINGS = ['This week', 'In the next two weeks', 'Later', 'Not sure'];
const EMPTY = { name: '', email: '', phone: '', service: '', timing: '', message: '', website: '' };

// The booking form inside the chat. The server checks every field again; the checks here only
// save the visitor a round trip.
export function BookingForm({ services, conversationId, onDone, onCancel }) {
  const [values, setValues] = useState(EMPTY);
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const set = (name) => (event) => setValues((v) => ({ ...v, [name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError('');
    setFields({});
    const result = await postJson('/api/leads', { ...values, ...(conversationId ? { conversationId } : {}) });
    setSending(false);
    if (result.ok) return onDone();
    setError(result.error);
    setFields(result.fields || {});
  }

  const problem = (name) => fields[name] && <span className="field-error" id={`${name}-error`}>{fields[name]}</span>;
  const described = (name) => (fields[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {});

  return (
    <form className="booking" onSubmit={submit} noValidate>
      <p className="booking-note">Demo form: please use a made-up name and email.</p>

      <label>Name
        <input value={values.name} onChange={set('name')} maxLength={80} autoComplete="off" required {...described('name')} />
        {problem('name')}
      </label>
      <label>Email
        <input type="email" value={values.email} onChange={set('email')} maxLength={120} autoComplete="off" required {...described('email')} />
        {problem('email')}
      </label>
      {/* The label text sits in one span: the label is a grid, and each child gets its own row. */}
      <label><span>Phone <span className="optional">(optional)</span></span>
        <input type="tel" value={values.phone} onChange={set('phone')} maxLength={30} autoComplete="off" {...described('phone')} />
        {problem('phone')}
      </label>
      <label>Service
        <select value={values.service} onChange={set('service')} required {...described('service')}>
          <option value="">Choose…</option>
          {services.map((name) => <option key={name}>{name}</option>)}
          <option>Not sure</option>
        </select>
        {problem('service')}
      </label>
      <label>When would you like to come?
        <select value={values.timing} onChange={set('timing')} required {...described('timing')}>
          <option value="">Choose…</option>
          {TIMINGS.map((name) => <option key={name}>{name}</option>)}
        </select>
        {problem('timing')}
      </label>
      <label><span>Anything else? <span className="optional">(optional)</span></span>
        <textarea value={values.message} onChange={set('message')} maxLength={500} rows={3} {...described('message')} />
        {problem('message')}
      </label>

      {/* Hidden from people; bots fill it in and are quietly ignored. */}
      <label className="hp" aria-hidden="true">Website
        <input value={values.website} onChange={set('website')} tabIndex={-1} autoComplete="off" />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="booking-actions">
        <button type="submit" className="button" disabled={sending}>{sending ? 'Sending…' : 'Send booking request'}</button>
        <button type="button" className="button-quiet" onClick={onCancel}>Back to chat</button>
      </div>
    </form>
  );
}
