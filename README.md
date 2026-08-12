<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# EduPlay

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

### Chat xavfsizligi va session-token migratsiyasi

Har bir `clientId` endi serverda yaratilgan, taxmin qilib bo'lmaydigan session
token bilan bog'langan (token `create-game` / `join-game` javobida qaytadi va
`localStorage`'da saqlanadi). Chat endpointlari (`/api/chat/send`,
`/api/chat/messages`, `/api/pusher/auth`) `clientId` BILAN birga token ham
talab qiladi — o'g'irlangan `clientId`'ning o'zi endi yetarli emas.

**Production migratsiya rejasi (qo'lda bajariladigan qadamlar):**

1. Deploy qiling. Yangi frontend avtomatik ravishda token oladi: keyingi har bir
   `create-game` / `join-game` chaqiruvida server token yaratib qaytaradi.
2. Eski (token'siz) brauzerlar uchun 30 kunlik imtiyoz davri bor: token'siz
   so'rov faqat `clientId` eski formatda (`UUID` yoki `id_<ts>_<rand>`) VA
   tizimda ro'yxatdan o'tgan bo'lsa qabul qilinadi (serverda `console.warn`
   log'i chiqadi). Buning muddatini uzaytirish/qisqartirish uchun
   `CHAT_LEGACY_TOKEN_GRACE_UNTIL` (unix ms yoki ISO sana) env o'zgaruvchisidan
   foydalaning.
3. 30 kundan keyin (yoki barcha faol brauzerlar qayta ro'yxatdan o'tgach) eski
   yo'lni butunlay o'chirish uchun `CHAT_LEGACY_TOKEN_GRACE_UNTIL=0` qilib qayta
   deploy qiling.

**Qo'shimcha sozlashlar:**

- `CHAT_RATE_LIMIT_MAX` (sukut: 20) — har bir `clientId` uchun `chat/send` soni
- `CHAT_RATE_LIMIT_WINDOW_SECONDS` (sukut: 60) — shu oyna (soniya) ichida

### Ishtirokchilar mavjudligi (presence) va raundlar

O'yin holati server tomonidan boshqariladi va Redis'da saqlanadi. Kim "onlayn"
ekanligini ham backend hal qiladi: o'qituvchi va har bir o'quvchi brauzeri
`/api/teacher-heartbeat` / `/api/student-heartbeat` orqali har ~5 soniyada
"men shu yerdaman" signalini yuboradi. Signal to'xtasa, imtiyoz muddati
(grace) o'tgach:

- **O'qituvchi** — o'yin avtomatik `GAME_OVER` holatiga o'tadi (o'yin o'chirilmaydi,
  o'qituvchi qaytib kelib "Yangi Raund (Guruhlar Saqlanadi)" orqali davom
  ettirishi mumkin). O'qituvchi sahifani yopsa, `pagehide` beacon
  (`/api/teacher-leave`) o'yinni darhol yakunlaydi.
- **O'quvchi** — o'yindan va guruhidan chiqariladi; agar sardor bo'lsa, sardorlik
  guruhdagi navbatdagi a'zoga o'tadi. Qayta ulangan o'quvchi reconnect orqali
  o'z o'rniga qaytadi (agar imtiyoz muddati tugamagan bo'lsa).

Bu "heartbeat + grace" — hech qanday realtime stackda "hard disconnect"
kafolati yo'q, shuning uchun bu standart heuristic usul.

- `PRESENCE_TEACHER_GRACE_MS` (sukut: 45000) — o'qituvchi jimgina qolsa, o'yin shu
  muddatdan keyin yakunlanadi
- `PRESENCE_STUDENT_GRACE_MS` (sukut: 90000) — o'quvchi shu muddatdan keyin o'yindan
  chiqariladi

**Raundlar:** har raund `QUESTIONS_PER_ROUND` (sukut: 5) ta savoldan iborat bo'lak.
Ballar barcha raundlar davomida kumulyativ yig'iladi (per-round reset yo'q).
`currentRound` har raund oxirida avtomatik oshadi va o'qituvchi panelida
"Raund N" ko'rinishida aks etadi.

- `QUESTIONS_PER_ROUND` (sukut: 5) — har raunddagi savollar soni

**PIN'ni yangilash (`/api/regenerate-pin`):** o'qituvchi "PIN'ni Yangilash"
tugmasini bossa, yangi tasodifiy PIN-kod yaratiladi va barcha o'quvchilar
chiqariladi. Guruhlar va to'plangan ballar saqlanib qoladi — o'quvchilar yangi
PIN bilan qayta ulanib, o'qituvchi ularni yana guruhlarga biriktiradi.



