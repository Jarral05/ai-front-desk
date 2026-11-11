import { useId, useState } from 'react';
import { postJson } from './api.js';
import { PasswordInput } from './PasswordInput.jsx';

// The owner's sign-in form. The browser's password manager can fill it: the autocomplete names
// below are the ones password managers look for.
//
// Each label points at its box by ID (htmlFor) instead of wrapping it. Wrapped, the Show/Hide
// button would sit inside the label, and screen readers would call the box "Password Show password".
export function OwnerLogin({ onSignedIn }) {
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  // Typing again clears the old message, so it never sits under boxes that are now filled in.
  const edit = (setValue) => (value) => {
    setValue(value);
    setError('');
  };

  async function submit(event) {
    event.preventDefault();
    // A friendly check first, so nobody waits for the server to say "fill this in". The form has
    // noValidate, so every browser shows this same message instead of its own pop-up bubble.
    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }
    setSending(true);
    setError('');
    const result = await postJson('/api/owner/login', { email: email.trim(), password });
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPassword('');
    onSignedIn(result.data.email);
  }

  return (
    <section className="owner-card owner-login" aria-labelledby="login-title">
      <h1 id="login-title">Owner sign-in</h1>
      <p className="quiet">
        For the clinic owner only. Visitors don't need an account: they use the chat on the clinic page.
      </p>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={emailId}>Email address</label>
          <input id={emailId} type="email" autoComplete="username" value={email} maxLength={120} required
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            aria-invalid={error && !email.trim() ? true : undefined}
            onChange={(event) => edit(setEmail)(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={passwordId}>Password</label>
          <PasswordInput id={passwordId} autoComplete="current-password" value={password} maxLength={200} required
            aria-invalid={error && !password ? true : undefined} onChange={edit(setPassword)} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button" disabled={sending}>{sending ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </section>
  );
}
