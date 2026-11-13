import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { configSchema } from './config.js';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid API configuration. Check PORT, NODE_ENV and MONGODB_URI against .env.example.');
  process.exit(1);
}
const config = parsed.data;
try {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
} catch {
  console.error('MongoDB connection failed. Check the local environment and database access.');
  process.exit(1);
}
const server = createApp(() => mongoose.connection.readyState === 1).listen(config.PORT, '127.0.0.1', () => {
  console.log(`GarmentFlow API listening on http://127.0.0.1:${config.PORT}`);
});
async function shutdown() {
  server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
