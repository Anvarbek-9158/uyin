import 'dotenv/config';
import { createServer as createViteServer } from 'vite';
import app from './app.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function main() {
  // In development, mount the Vite dev server (HMR, TS transforms). In
  // production the built static files in dist/ are served by app.ts (local) or
  // by Vercel's CDN via vercel.json (when deployed).
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduPlay serveri ishga tushdi: http://0.0.0.0:${PORT}`);
  });
}

main();
