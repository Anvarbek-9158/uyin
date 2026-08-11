<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Raqamli Viktorina

Real-time o'quv viktorina va chempionat platformasi.

- Frontend: React + Vite
- Realtime: Pusher Channels
- Backend: Express (`/api/*`)
- Holat saqlash: Upstash Redis / Vercel KV (serverless uchun), lokalde xotirada

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and fill in your Pusher credentials.
3. Run the app:
   `npm run dev`
   (Ochiq: http://localhost:3000)

## Deploy to Vercel

Ushbu loyiha Vercel serverless uchun tayyorlangan (`vercel.json` + `api/index.ts`).
Vercel serverless lambda'lari statsiz, shuning uchun o'yin holati uchun Redis (Vercel KV) kerak.

1. Loyihani Vercel'ga ulang va deploy qiling.
2. **Vercel Storage -> KV** bo'limida Redis store yarating. Unda berilgan env o'zgaruvchilarni loyiha sozlamalariga qo'shing:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
3. Pusher Channels sozlamalarini ham Vercel'ga qo'shing (server va klient uchun):
   - `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`
   - `VITE_PUSHER_KEY`, `VITE_PUSHER_CLUSTER` (build vaqtida ishlatiladi)
4. Qayta deploy qiling. API: `https://<sizning-domen>/api/health`.

### Eslatmalar

- Javob berish taymeri o'qituvchi brauzeri tomonidan boshqariladi
  (`/api/timer-tick` har soniyada), chunki serverless'da `setInterval` ishlamaydi.
- Savollar bazasi `questions_db.json` (lokal) yoki Redis'da (serverless) saqlanadi.

