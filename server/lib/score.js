// The lead score comes from written rules, not from the AI's opinion. The AI only reports what
// the visitor seems to want (intent); the points below decide Hot, Warm or Cold, and every
// point has a reason the owner can read.
const TIMING_POINTS = {
  'This week': [2, 'Wants a time this week (+2)'],
  'In the next two weeks': [1, 'Wants a time in the next two weeks (+1)'],
};
const INTENT_POINTS = {
  ready_to_book: [1, 'Ready to book (+1)'],
  question_only: [-1, 'Only asked a question (-1)'],
};

export function scoreLead({ timing, service, intent }) {
  // No intent means the AI failed or answered badly: the lead is kept, but not scored.
  if (!intent) return { score: 'Unscored', reasons: [] };

  let points = 0;
  const reasons = [];
  const add = (entry) => {
    if (!entry) return;
    points += entry[0];
    reasons.push(entry[1]);
  };
  add(TIMING_POINTS[timing]);
  if (service && service !== 'Not sure') add([1, `Named a service: ${service} (+1)`]);
  add(INTENT_POINTS[intent]);

  const score = points >= 3 ? 'Hot' : points === 2 ? 'Warm' : 'Cold';
  return { score, reasons };
}
