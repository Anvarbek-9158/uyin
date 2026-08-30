// Vercel serverless function handler.
// The entire Express app (all /api/* endpoints) is exported as the default
// handler. Vercel's @vercel/node builder detects this and routes every
// matching request into the same Express app.
import app from '../app.js';

export default app;
