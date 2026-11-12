// GET /api/my-lead: "See what the owner sees" (Part 6, spec feature 7).
//
// Sending the booking form gives this browser a random token in an HttpOnly cookie; the lead keeps
// only the token's SHA-256. So a visitor can see their own lead and no other: there is no lead ID
// in the address to change, and page scripts can't read the cookie.
import { randomBytes } from 'node:crypto';
import express from 'express';
import { LIMITS } from '../config.js';
import { HttpError } from '../errors.js';
import { Lead } from '../models.js';
import { getClinic } from '../lib/knowledge.js';
import { visitorLead } from '../lib/leadView.js';
import { readCookie, sha256 } from '../lib/ownerSession.js';
import { sampleLeadDocs } from '../lib/samples.js';

export function myLeadCookie(secure) {
  return {
    name: secure ? '__Host-fd_my_lead' : 'fd_my_lead',
    options: {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: LIMITS.keepHours * 60 * 60 * 1000, // as long as the lead itself
    },
  };
}

// A new token for a new lead: the cookie gets the token, the lead gets its fingerprint.
export function newViewToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: sha256(token) };
}

export function myLeadRoutes({ secure }) {
  const router = express.Router();
  const cookie = myLeadCookie(secure);

  router.get('/', async (req, res) => {
    const token = readCookie(req, cookie.name);
    const lead = token ? await Lead.findOne({ viewToken: sha256(token) }).lean() : null;
    if (!lead) {
      throw new HttpError(404, "There's no booking from this browser to show. Bookings delete themselves after 24 hours.");
    }
    // The example leads are made in memory for this answer, never saved, so one buyer never sees
    // another's examples or the owner's real leads.
    const clinic = await getClinic();
    const examples = sampleLeadDocs(clinic.sampleLeads, clinic.services.map((s) => s.name))
      .map((doc, i) => ({ ...visitorLead(doc), id: `example-${i + 1}` }));
    res.json({ business: clinic.name, place: clinic.place, lead: visitorLead(lead), examples });
  });

  return router;
}
