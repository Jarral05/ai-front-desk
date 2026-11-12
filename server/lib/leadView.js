// What the owner sees of a lead. The visitor's fingerprint, chat ID and viewing token stay on the
// server. Shared by the dashboard (routes/owner.js) and the buyer's view (routes/myLead.js).
export function ownerLead(lead) {
  return {
    id: String(lead._id),
    receivedAt: lead.createdAt,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    service: lead.service,
    timing: lead.timing,
    message: lead.message,
    summary: lead.summary,
    score: lead.score,
    scoreReasons: lead.scoreReasons,
    status: lead.status,
    sample: Boolean(lead.sample),
    // "off" when email or the sheet isn't set up; "failed" shows as "Not sent" with Retry.
    notify: {
      email: lead.notify?.email?.status ?? 'off',
      sheet: lead.notify?.sheet?.status ?? 'off',
    },
  };
}

// The buyer sees their lead exactly as the owner would, without the owner's delivery details.
export function visitorLead(lead) {
  const { notify: _notify, ...view } = ownerLead(lead);
  return view;
}
