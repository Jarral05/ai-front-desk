import mongoose from 'mongoose';
import { config } from './config.js';

// Filters may only use fields that exist in the schema.
mongoose.set('strictQuery', true);

export async function connectDatabase(uri = config.mongoUri) {
  if (uri) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    return;
  }
  // Local development only: a throwaway database in memory, so no setup is needed.
  const { MongoMemoryServer } = await import('mongodb-memory-server-core');
  const memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri('front-desk'));
  console.log('Using a temporary in-memory database. Data is lost when the server stops.');
}
