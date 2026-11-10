// The three things the app stores. Each deletes itself through a TTL index on `expiresAt`:
// MongoDB checks about once a minute and removes documents whose time has passed.
import mongoose from 'mongoose';
import { LIMITS } from './config.js';

const { Schema, model } = mongoose;

export function expiresInHours(hours = LIMITS.keepHours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// One counter per limit and time window, for example "ai-day:2026-11-10".
// Kept in the database, so restarting the app can't reset the daily AI cap.
const counterSchema = new Schema({
  _id: String,
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });
counterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Counter = model('Counter', counterSchema);

const messageSchema = new Schema({
  role: { type: String, enum: ['visitor', 'assistant'], required: true },
  text: { type: String, required: true, maxlength: 2000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

// A chat lives on the server, so a visitor can't hand the AI a made-up history.
const conversationSchema = new Schema({
  _id: String, // a random UUID, never a number someone could guess
  visitor: { type: String, required: true }, // a hash of the IP, not the IP itself
  messages: { type: [messageSchema], default: [] },
  visitorMessages: { type: Number, default: 0 },
  expiresAt: { type: Date, default: () => expiresInHours() },
}, { timestamps: true, versionKey: false });
conversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Conversation = model('Conversation', conversationSchema);

export const SCORES = ['Hot', 'Warm', 'Cold', 'Unscored'];
export const TIMINGS = ['This week', 'In the next two weeks', 'Later', 'Not sure'];

const leadSchema = new Schema({
  name: { type: String, required: true, maxlength: 80 },
  email: { type: String, required: true, maxlength: 120 },
  phone: { type: String, default: '', maxlength: 30 },
  service: { type: String, required: true, maxlength: 80 },
  timing: { type: String, enum: TIMINGS, required: true },
  message: { type: String, default: '', maxlength: 500 },
  conversationId: { type: String, default: null },
  visitor: { type: String, required: true },
  summary: { type: String, default: null, maxlength: 400 },
  intent: { type: String, default: null },
  score: { type: String, enum: SCORES, default: 'Unscored' },
  scoreReasons: { type: [String], default: [] },
  status: { type: String, enum: ['New', 'Contacted'], default: 'New' },
  expiresAt: { type: Date, default: () => expiresInHours() },
}, { timestamps: true, versionKey: false });
leadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
leadSchema.index({ createdAt: -1 });
export const Lead = model('Lead', leadSchema);
