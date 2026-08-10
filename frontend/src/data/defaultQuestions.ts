import { Question } from '../types';

export const DEFAULT_QUESTIONS: Question[] = [
  // Oson (Easy)
  {
    id: 'def_1',
    text: "Kompyuterning asosiy mantiqiy hisoblash va boshqaruv qurilmasi qaysi?",
    options: ["Protsessor (CPU)", "Operativ xotira (RAM)", "Qattiq disk (HDD)", "Videokarta (GPU)"],
    correctAnswer: "Protsessor (CPU)",
    timeLimit: 30,
    category: "Informatika",
    difficulty: "Oson",
    explanation: "Protsessor kompyuterning barcha buyruq va hisob-kitoblarni bajaruvchi miyasi hisoblanadi."
  },
  {
    id: 'def_2',
    text: "1 Gigabayt (GB) necha Megabayt (MB) ga teng?",
    options: ["1024 MB", "1000 MB", "512 MB", "2048 MB"],
    correctAnswer: "1024 MB",
    timeLimit: 30,
    category: "Informatika",
    difficulty: "Oson",
    explanation: "Ikkilik sanoq tizimida 1 GB = 2^10 MB = 1024 MB ga teng."
  },
  {
    id: 'def_3',
    text: "Eng kichik tub son nechaga teng?",
    options: ["2", "1", "3", "0"],
    correctAnswer: "2",
    timeLimit: 25,
    category: "Matematika",
    difficulty: "Oson",
    explanation: "2 yagona juft tub son va eng kichik tub sondir."
  },
  // O'rta (Medium)
  {
    id: 'def_4',
    text: "To'g'ri burchakli uchburchakda gipotenuza kvadratiga bag'ishlangan teorema muallifi kim?",
    options: ["Pifagor", "Evklid", "Arximed", "Nyuton"],
    correctAnswer: "Pifagor",
    timeLimit: 35,
    category: "Geometriya",
    difficulty: "O'rta",
    explanation: "Pifagor teoremasiga ko'ra: a² + b² = c²."
  },
  {
    id: 'def_5',
    text: "Python dasturlash tilida ro'yxatga yangi element qo'shuvchi metod qaysi?",
    options: ["append()", "add()", "push()", "insert_end()"],
    correctAnswer: "append()",
    timeLimit: 30,
    category: "Dasturlash",
    difficulty: "O'rta",
    explanation: "Python'da append() metodi elementni ro'yxat oxiriga qo'shadi."
  },
  {
    id: 'def_6',
    text: "Doiraning yuzini topish formulasi qanday ifodalanadi?",
    options: ["S = πr²", "S = 2πr", "S = πd", "S = 4πr²"],
    correctAnswer: "S = πr²",
    timeLimit: 30,
    category: "Matematika",
    difficulty: "O'rta",
    explanation: "r - doira radiusi bo'lganda uning yuzi S = πr² bo'ladi."
  },
  // Qiyin (Hard)
  {
    id: 'def_7',
    text: "Taqsimlangan ma'lumotlar bazalarida CAP teoremasiga ko'ra 3 ta kafolatdan bir vaqtda nechtasiga erishish mumkin?",
    options: ["Faqat 2 tasiga", "Barcha 3 tasiga", "Faqat 1 tasiga", "Birontasiga emas"],
    correctAnswer: "Faqat 2 tasiga",
    timeLimit: 45,
    category: "Informatika",
    difficulty: "Qiyin",
    explanation: "CAP teoremasiga ko'ra (Consistency, Availability, Partition tolerance) bir vaqtning o'zida ko'pi bilan 2 ta kafolat ta'minlanadi."
  },
  {
    id: 'def_8',
    text: "Kvadrat tenglama diskriminanti D < 0 bo'lsa, haqiqiy ildizlar soni nechta bo'ladi?",
    options: ["0 ta (haqiqiy ildizga ega emas)", "1 ta", "2 ta", "Cheksiz ko'p"],
    correctAnswer: "0 ta (haqiqiy ildizga ega emas)",
    timeLimit: 40,
    category: "Algebra",
    difficulty: "Qiyin",
    explanation: "Diskriminant manfiy bo'lsa, tenglama haqiqiy sonlar to'plamida ildizga ega bo'lmaydi (kompleks ildizlar bor)."
  }
];
