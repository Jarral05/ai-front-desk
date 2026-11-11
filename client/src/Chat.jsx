import { useEffect, useRef, useState } from 'react';
import { postJson } from './api.js';
import { BookingForm } from './BookingForm.jsx';

const MAX = 500;

// The chat window. Every message, including the AI's, is shown as plain text: React puts it in
// the page as text, so anything that looks like HTML in a reply is displayed, never run.
export function Chat({ clinic, open, onOpen, onClose, question, onQuestionUsed }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: clinic.greeting }]);
  const [conversationId, setConversationId] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [view, setView] = useState('chat'); // 'chat' | 'form' | 'thanks'
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, view, open]);

  useEffect(() => {
    if (open && view === 'chat') inputRef.current?.focus();
  }, [open, view]);

  async function send(text) {
    const message = text.trim();
    if (!message || sending) return;
    setView('chat');
    setSending(true);
    setDraft('');
    setMessages((list) => [...list, { role: 'visitor', text: message }]);
    const result = await postJson('/api/chat', { message, ...(conversationId ? { conversationId } : {}) });
    setSending(false);
    if (result.ok) {
      setConversationId(result.data.conversationId);
      setMessages((list) => [...list, { role: 'assistant', text: result.data.reply }]);
    } else {
      setMessages((list) => [...list, { role: 'notice', text: result.error }]);
    }
  }

  // A "Try asking" question from the page is sent once the chat is open.
  useEffect(() => {
    if (open && question) {
      onQuestionUsed();
      send(question);
    }
  }, [open, question]);

  if (!open) {
    return (
      <button type="button" className="chat-bubble" onClick={onOpen} aria-label="Open the chat">
        Chat with us
      </button>
    );
  }

  return (
    <section className="chat" role="dialog" aria-label={`Chat with the ${clinic.place}'s AI assistant`}>
      <header className="chat-head">
        <div>
          <strong>AI assistant</strong>
          <span>Answers from the {clinic.place}'s facts</span>
        </div>
        <button type="button" className="chat-close" onClick={onClose} aria-label="Close the chat">×</button>
      </header>

      <div className="chat-body">
        <ol className="messages" aria-live="polite">
          {messages.map((m, i) => (
            // The list only ever grows, so the position is a stable key. dir="auto" lets the
            // browser lay out an Urdu message right to left and an English one left to right.
            <li key={i} dir="auto" className={`msg msg-${m.role}`}>{m.text}</li>
          ))}
          {sending && <li className="msg msg-assistant msg-typing">Typing…</li>}
        </ol>

        {view === 'form' && (
          <BookingForm
            services={clinic.services.map((s) => s.name)}
            contact={clinic.contact}
            conversationId={conversationId}
            onDone={() => setView('thanks')}
            onCancel={() => setView('chat')}
          />
        )}
        {view === 'thanks' && (
          <p className="thanks" role="status">
            Thank you. Your booking request has been sent to the {clinic.place}, and they'll get back to you.
            In this demo nothing is booked, and your details delete themselves within 24 hours.
          </p>
        )}
        <div ref={endRef} />
      </div>

      {view === 'chat' && (
        <footer className="chat-foot">
          <button type="button" className="book-button" onClick={() => setView('form')}>Book an appointment</button>
          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <label htmlFor="chat-message" className="sr-only">Your message</label>
            <textarea
              id="chat-message"
              ref={inputRef}
              rows={2}
              maxLength={MAX}
              value={draft}
              placeholder="Ask about prices, hours or booking…"
              dir="auto"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send(draft);
                }
              }}
            />
            <button type="submit" className="button" disabled={sending || !draft.trim()}>Send</button>
          </form>
          <p className="counter" aria-live="off">{draft.length}/{MAX}</p>
        </footer>
      )}
    </section>
  );
}
