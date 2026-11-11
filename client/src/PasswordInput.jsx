import { useState } from 'react';

// A small eye drawn here, so no icon package is needed. The slash is added for "Hide".
function EyeIcon({ crossed }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M3 3l18 18" />}
    </svg>
  );
}

// A password box with a Show/Hide button, the same as the client portal's.
// The button only changes what the browser displays; the password goes nowhere else.
export function PasswordInput({ value, onChange, ...rest }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-box">
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // Phones would otherwise capitalise or "correct" a password while it's visible.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="password-toggle"
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible((shown) => !shown)}
      >
        <EyeIcon crossed={visible} />
        <span aria-hidden="true">{visible ? 'Hide' : 'Show'}</span>
      </button>
    </div>
  );
}
