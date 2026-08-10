# Raqamli Viktorina - Backend Server (Node.js + Express + Socket.IO)

Ushbu papka **Raqamli Viktorina** o'yini uchun alohida ajratilgan Node.js backend server hisoblanadi.

## 🚀 Serverni O'rnatish va Ishga Tushirish

### 1. Qaramliklarni o'rnatish
```bash
cd backend
npm install
```

### 2. Atrof-muhit o'zgaruvchilarini sozlash (.env)
Alohida `.env` fayl yarating va kerakli kalitlarni kiritishingiz mumkin:
```env
PORT=3000
GEMINI_API_KEY=sizning_gemini_api_kalitingiz
```

### 3. Serverni ishlab chiqish (Dev) rejimida indatish:
```bash
npm run dev
```
Server `http://localhost:3000` manzilida ishga tushadi.

### 4. Serverni kompiyatsiya qilish va production da ishga tushirish:
```bash
npm run build
npm start
```

## 🛠 Impotant Xususiyatlar
- **Real-time Socket.IO**: Barcha o'quvchilar va o'qituvchi o'rtasida real-vaqt rejimida tezkor va ishonchli aloqa.
- **Persistent Questions DB**: Yaratilgan yoki tahrirlangan savollar `questions_db.json` faylida xavfsiz saqlanadi.
- **Gemini AI API Intergration**: AI yordamida har qanday fandan avtomatik testlar va darslik rasmidan savollar generatsiya qilish.
- **CORS sozlamalari**: Frontend boshqa domenda (masalan Netlify, Vercel yoki alohida serverda) joylashsa ham bemalol ulanadi.
