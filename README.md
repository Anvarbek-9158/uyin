# EduPlay — Taʼlim Platformasi

Oʻqituvchi va oʻquvchi uchun moslashtirilgan taʼlim veb-sayti.

- **Frontend:** React 19 + Vite + Tailwind CSS v4
- **Routing:** React Router (Hash Router)
- **Auth:** Google / GitHub / Apple / Email (demo formlar)
- **Rejim:** Dark / Light (localStorage'da saqlanadi)
- **Dizayn:** Responsive, zamonaviy, minimalistik

## Imkoniyatlar

- Bosh sahifada ikkita rol kartasi: **Men Oʻqituvchiman** va **Men Oʻquvchiman**
- Mustaqil, bir-biridan dizayni farqli qidiruvlar:
  - **Teacher** (koʻk/indigo) — oʻquvchilar, kurslar, darslar
  - **Student** (yashil/emerald) — oʻqituvchilar, fanlar, kurslar
- Alohida roʻyxatdan oʻtish (Login / Sign up) — Google, GitHub, Apple, Email
- 3 ta tarif: **Bepul** ($0), **Oylik** ($1/oy), **Yillik** ($15/yil, "Tejamkor")
- Header'da Dark/Light almashtirish tugmasi butun sayt boʻylab ishlaydi
- Header navigatsiyasi: Bosh sahifa, Teacher, Student, Narxlar, Kirish/Roʻyxatdan oʻtish

## Sahifalar / Routing

| Yoʻl              | Sahifa                          |
| ----------------- | ------------------------------- |
| `/`               | Bosh sahifa (Hero + rol kartalari) |
| `/teacher`        | Teacher qidiruvi                |
| `/student`        | Student qidiruvi                |
| `/teacher/auth`   | Oʻqituvchi roʻyxatdan oʻtish    |
| `/student/auth`   | Oʻquvchi roʻyxatdan oʻtish      |
| `/pricing`        | Tariflar                        |

## Ikkiga boʻlingan qidiruv

Teacher va Student qidiruvlari bir-biridan **mustaqil** va dizayni bilan farqlanadi:

- **Teacher** — indigo/koʻk rang, `GraduationCap` ikonka, "oʻquvchilar, kurslar, darslar"
- **Student** — emerald/yashil rang, `Users` ikonka, "oʻqituvchilar, fanlar, kurslar"

## Dark / Light rejim

ThemeToggle tugmasi `edupal-theme` kalitini `localStorage`'da saqlaydi.
Tizimning afzal koʻrgan rejimi (prefers-color-scheme) sukut sifatida ishlatiladi.

## Ishga tushirish

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build / preview

```bash
npm run build    # dist/ papkasiga quriladi
npm run preview  # qurilgan saytni koʻrish
npm run lint     # TypeScript tekshiruvi
```

> Eslatma: Auth (Google/GitHub/Apple) va toʻlov tizimlari hozircha **demo** hisoblanadi —
> uchastka tugmachalari bosilganda simulatsiya qilinadi. Haqiqiy integratsiya uchun
> tegishli OAuth va toʻlov kalitlarini ulash kerak.
