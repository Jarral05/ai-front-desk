// One lead, as the owner sees it. Used by the dashboard (Leads.jsx) and by the buyer's
// "See what the owner sees" page (MyLead.jsx). Every name, message and summary is plain text.

// Dates in the reader's own language and time zone, as their browser reports them.
const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function LeadCard({ lead, tag, highlight = false, children }) {
  return (
    <li className={`owner-card lead${highlight ? ' lead-mine' : ''}`}>
      <div className="lead-top">
        <h2>{lead.name}{tag && <span className="sample-tag">{tag}</span>}</h2>
        <span className={`badge badge-${lead.score.toLowerCase()}`}>{lead.score}</span>
      </div>
      <p className="quiet lead-meta">
        {when.format(new Date(lead.receivedAt))} · {lead.service} · {lead.timing}
      </p>
      {lead.summary
        ? <p>{lead.summary}</p>
        : <p className="quiet">No AI summary: the AI wasn't available when this lead came in.</p>}
      {lead.scoreReasons.length > 0 && (
        <ul className="reasons" aria-label="Why this score">
          {lead.scoreReasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      )}
      {lead.message && <p><span className="quiet">Their message: </span><span dir="auto">{lead.message}</span></p>}
      <p>
        {lead.email && <a href={`mailto:${lead.email}`}>{lead.email}</a>}
        {lead.email && lead.phone && ' · '}
        {lead.phone}
      </p>
      {children}
    </li>
  );
}
