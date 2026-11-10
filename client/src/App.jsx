import { useEffect, useState } from 'react';
import { Chat } from './Chat.jsx';

// The clinic page, filled from GET /api/clinic, with the AI chat in the corner.
export function App() {
  const [clinic, setClinic] = useState(null);
  const [failed, setFailed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [question, setQuestion] = useState('');

  const ask = (text) => {
    setQuestion(text);
    setChatOpen(true);
  };

  useEffect(() => {
    let active = true;
    fetch('/api/clinic')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => active && setClinic(data))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div className="demo-bar" role="note">
        Demo website for a made-up clinic. Please don't enter real personal details.
      </div>
      <header className="site-header">
        <div className="wrap">
          <span className="logo">{clinic?.name ?? 'Maple Lane Physio (Demo)'}</span>
        </div>
      </header>

      <main className="wrap">
        {failed && <p className="notice">The clinic details couldn't load. Please refresh the page.</p>}
        {!clinic && !failed && <p className="quiet">Loading…</p>}
        {clinic && (
          <>
            <section className="hero">
              <h1>{clinic.name}</h1>
              <p className="lead">{clinic.tagline}</p>
              <div className="try-asking">
                <p className="quiet">Try asking our AI assistant:</p>
                <ul>
                  {clinic.tryAsking.map((text) => (
                    <li key={text}>
                      <button type="button" className="chip" onClick={() => ask(text)}>{text}</button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section aria-labelledby="services-title">
              <h2 id="services-title">Services</h2>
              <ul className="cards">
                {clinic.services.map((service) => (
                  <li key={service.name} className="card">
                    <h3>{service.name}</h3>
                    <p className="quiet">{service.minutes} minutes</p>
                    <p className="price">${service.price}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="two-cols">
              <div>
                <h2>Opening hours</h2>
                <ul className="plain">
                  {clinic.hours.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
              <div>
                <h2>Good to know</h2>
                <ul className="plain">
                  {clinic.facts.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="wrap">A demo app. The clinic, its people and its prices are invented.</div>
      </footer>

      {clinic && (
        <Chat
          clinic={clinic}
          open={chatOpen}
          onOpen={() => setChatOpen(true)}
          onClose={() => setChatOpen(false)}
          question={question}
          onQuestionUsed={() => setQuestion('')}
        />
      )}
    </>
  );
}
