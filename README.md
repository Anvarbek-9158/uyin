# EduPlay — Taʼlim Platformasi

Oʻqituvchi va oʻquvchi uchun moslashtirilgan taʼlim veb-sayti.

- **Frontend:** React 19 + Vite + Tailwind CSS v4
- **Routing:** React Router (Hash Router)
- **Auth:** Google / GitHub / Apple / Email (demo formlar)
- **Rejim:** Doimiy qorong'i (dark) interfeys
- **Dizayn:** Responsive, zamonaviy, minimalistik

## Imkoniyatlar

- Bosh sahifada ikkita rol kartasi: **Men Oʻqituvchiman** va **Men Oʻquvchiman**
- Mustaqil, bir-biridan dizayni farqli qidiruvlar:
  - **Teacher** (koʻk/indigo) — oʻquvchilar, kurslar, darslar
  - **Student** (yashil/emerald) — oʻqituvchilar, fanlar, kurslar
- Alohida roʻyxatdan oʻtish (Login / Sign up) — Google, GitHub, Apple, Email
- 3 ta tarif: **Bepul** ($0), **Oylik** ($1/oy), **Yillik** ($15/yil, "Tejamkor")
- Header qidiruv, bildirishnoma va dark/light tugmalari olib tashlangan — ilova doimiy dark rejimda
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

## Rejim

Ilova **doimiy qorong'i (dark)** rejimda ishlaydi va `#0f1116` fonini ishlatadi.
Ilgari mavjud dark/light almashtirish tugmasi (ThemeToggle) olib tashlangan —
`edupal-theme` kaliti `localStorage'da saqlanadi, quyuq rejim sukut hisoblanadi.

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
