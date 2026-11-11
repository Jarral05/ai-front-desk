// A safety net that doesn't depend on the AI. Obvious emergencies get a fixed answer straight
// away, even when the AI is down, busy or over its daily limit.
const EMERGENCY = [
  /chest pain/i,
  /heart attack/i,
  /\bstroke\b/i,
  /(can'?t|cannot|can not|unable to|struggling to|trouble) breath/i,
  /not breathing/i,
  /unconscious/i,
  /(heavy|severe|a lot of|won'?t stop) bleed/i,
  /bleeding (heavily|a lot|badly)/i,
  /overdose/i,
  // Not "hurt myself": at a physio clinic that is usually a sports injury, not an emergency.
  /suicid|kill myself|end my life|self[- ]harm/i,
];

export const EMERGENCY_REPLY = 'This sounds like it could be an emergency. Please contact your local '
  + 'emergency services now (for example 911, 999 or 112). This chat is a demo and cannot help '
  + 'in an emergency.';

// `extra` is a profile's own list (lib/profiles.js), for example a children's hospital's.
export function looksLikeEmergency(text, extra = []) {
  return matchesAny(text, [...EMERGENCY, ...extra]);
}

// The same check for any other fixed-answer list, such as a hospital's medicine questions.
export function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}
