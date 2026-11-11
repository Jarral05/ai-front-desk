// Sample leads for showing the owner's dashboard to a buyer, so it isn't empty in a meeting.
// All made up. `service` is a position in the profile's own service list (-1 means "Not sure"),
// so a private profile's services, or the owner's edited ones, are used. The score is worked out
// by lib/score.js like any real lead's, never written here.
import { scoreLead } from './score.js';

export const CLINIC_SAMPLES = Object.freeze([
  {
    name: 'Olivia P.', email: 'olivia.p@example.com', phone: '', service: 0, timing: 'This week', hoursAgo: 0.4,
    message: 'Knee pain after a half marathon. Evenings suit me best.',
    summary: 'Olivia wants a first assessment for knee pain after a half marathon. She would like an evening appointment this week.',
    intent: 'ready_to_book',
  },
  {
    name: 'Daniel R.', email: 'daniel.r@example.com', phone: '', service: 2, timing: 'In the next two weeks', hoursAgo: 2.5,
    message: 'Do you have Saturday slots?',
    summary: 'Daniel is asking about a sports massage and whether Saturday slots are free. He is looking at the next two weeks.',
    intent: 'comparing_options',
  },
  {
    name: 'Priya S.', email: 'priya.s@example.com', phone: '', service: -1, timing: 'Not sure', hoursAgo: 5,
    message: 'Do I need a referral for back pain?',
    summary: 'Priya asked whether she needs a referral for back pain. She has not chosen a service or a time yet.',
    intent: 'question_only',
  },
  {
    name: 'Tom W.', email: 'tom.w@example.com', phone: '', service: 1, timing: 'This week', hoursAgo: 7,
    message: "Follow-up after last week's session.",
    summary: "Tom wants a follow-up treatment after last week's session. He would like to come this week.",
    intent: 'ready_to_book',
  },
  {
    name: 'Grace L.', email: 'grace.l@example.com', phone: '', service: 3, timing: 'Later', hoursAgo: 11,
    message: 'I move abroad next month. Can I continue online?',
    summary: 'Grace is moving abroad next month and asked about online video consultations. She has no date in mind yet.',
    intent: 'comparing_options',
  },
  {
    name: 'Mark H.', email: 'mark.h@example.com', phone: '', service: 0, timing: 'In the next two weeks', hoursAgo: 19,
    message: 'Shoulder stiffness from a desk job.',
    summary: 'Mark wants a first assessment for shoulder stiffness from desk work. He is looking at the next two weeks.',
    intent: 'ready_to_book',
  },
]);

// Visitors write in Roman Urdu, Urdu or English; the owner's summaries are in English. Phone
// numbers end in seven zeros, and the UK one is from Ofcom's range kept for drama and examples.
export const HOSPITAL_SAMPLES = Object.freeze([
  {
    name: 'Sana A.', email: '', phone: '0300 0000000', service: 1, timing: 'This week', hoursAgo: 0.3,
    message: 'Beti 5 din ki hai, pehla check-up karwana hai. Shaam ka time behtar hai.',
    summary: 'A parent wants a first check-up for a 5-day-old baby girl. They would prefer an evening time this week.',
    intent: 'ready_to_book',
  },
  {
    name: 'Imran K.', email: '', phone: '0312 0000000', service: 2, timing: 'This week', hoursAgo: 1.5,
    message: 'Bete ki 9 mahine wali vaccination due hai. Card saath laana hai?',
    summary: 'A parent wants the 9-month vaccination for their son this week. They asked whether to bring the vaccination card.',
    intent: 'ready_to_book',
  },
  {
    name: 'Farah N.', email: '', phone: '0345 0000000', service: 0, timing: 'In the next two weeks', hoursAgo: 4,
    message: 'میرے بیٹے کو بار بار کھانسی ہوتی ہے۔ شام کو کون سے ڈاکٹر صاحب ہوتے ہیں؟',
    summary: 'A parent wants a child specialist check-up for a son with a recurring cough. They asked which doctor sees patients in the evening.',
    intent: 'ready_to_book',
  },
  {
    name: 'Usman B.', email: 'usman.b@example.com', phone: '+44 7700 900123', service: 3, timing: 'In the next two weeks', hoursAgo: 9,
    message: 'Writing from Bradford. My parents in Mirpur will bring my nephew for a growth check. Can they pay by card?',
    summary: 'A relative in the UK is arranging a growth and nutrition check for his nephew, who will come with his grandparents. He asked about card payment.',
    intent: 'comparing_options',
  },
  {
    name: 'Rabia M.', email: '', phone: '0333 0000000', service: -1, timing: 'Not sure', hoursAgo: 13,
    message: 'Kya Sunday ko OPD hoti hai?',
    summary: 'A parent asked whether the OPD is open on Sunday. They have not chosen a service or a time.',
    intent: 'question_only',
  },
  {
    name: 'Bilal H.', email: '', phone: '0301 0000000', service: 0, timing: 'Later', hoursAgo: 20,
    message: 'Next month school ke medical form ke liye check-up chahiye.',
    summary: 'A parent needs a check-up for a school medical form next month. They have not fixed a date yet.',
    intent: 'comparing_options',
  },
]);

// The documents to save: the profile's samples on the business's current services.
export function sampleLeadDocs(samples, serviceNames, now = Date.now()) {
  return samples.map((sample) => {
    const service = sample.service < 0 || serviceNames.length === 0
      ? 'Not sure'
      : serviceNames[sample.service % serviceNames.length];
    const { score, reasons } = scoreLead({ timing: sample.timing, service, intent: sample.intent });
    const at = new Date(now - sample.hoursAgo * 60 * 60 * 1000);
    return {
      name: sample.name,
      email: sample.email,
      phone: sample.phone,
      service,
      timing: sample.timing,
      message: sample.message,
      summary: sample.summary,
      intent: sample.intent,
      score,
      scoreReasons: reasons,
      visitor: 'sample',
      sample: true,
      createdAt: at,
      updatedAt: at,
      // Like every lead: gone 24 hours after it was saved.
      expiresAt: new Date(now + 24 * 60 * 60 * 1000),
    };
  });
}
