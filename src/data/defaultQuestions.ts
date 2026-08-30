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
    explanation: "Protsessor kompyuterning barcha buyruq va hisob-kitoblarini bajaruvchi miyasi hisoblanadi.",
    translations: {
      ru: {
        text: "Какое устройство является основным устройством вычислений и управления компьютера?",
        options: ["Процессор (CPU)", "Оперативная память (RAM)", "Жёсткий диск (HDD)", "Видеокарта (GPU)"],
        correctAnswer: "Процессор (CPU)",
        category: "Информатика",
        difficulty: "Легкий",
        explanation: "Процессор — это мозг компьютера, который выполняет все команды и вычисления."
      },
      en: {
        text: "Which device is the main computing and control unit of a computer?",
        options: ["Processor (CPU)", "Random Access Memory (RAM)", "Hard Disk (HDD)", "Graphics Card (GPU)"],
        correctAnswer: "Processor (CPU)",
        category: "Computer Science",
        difficulty: "Easy",
        explanation: "The processor is the brain of the computer that executes all commands and calculations."
      }
    }
  },
  {
    id: 'def_2',
    text: "1 Gigabayt (GB) necha Megabayt (MB) ga teng?",
    options: ["1024 MB", "1000 MB", "512 MB", "2048 MB"],
    correctAnswer: "1024 MB",
    timeLimit: 30,
    category: "Informatika",
    difficulty: "Oson",
    explanation: "Ikkilik sanoq tizimida 1 GB = 2^10 MB = 1024 MB ga teng.",
    translations: {
      ru: {
        text: "1 Гигабайт (ГБ) равен скольким Мегабайтам (МБ)?",
        options: ["1024 МБ", "1000 МБ", "512 МБ", "2048 МБ"],
        correctAnswer: "1024 МБ",
        category: "Информатика",
        difficulty: "Легкий",
        explanation: "В двоичной системе счисления 1 ГБ = 2^10 МБ = 1024 МБ."
      },
      en: {
        text: "1 Gigabyte (GB) equals how many Megabytes (MB)?",
        options: ["1024 MB", "1000 MB", "512 MB", "2048 MB"],
        correctAnswer: "1024 MB",
        category: "Computer Science",
        difficulty: "Easy",
        explanation: "In the binary system, 1 GB = 2^10 MB = 1024 MB."
      }
    }
  },
  {
    id: 'def_3',
    text: "Eng kichik tub son nechaga teng?",
    options: ["2", "1", "3", "0"],
    correctAnswer: "2",
    timeLimit: 25,
    category: "Matematika",
    difficulty: "Oson",
    explanation: "2 yagona juft tub son va eng kichik tub sondir.",
    translations: {
      ru: {
        text: "Чему равно наименьшее простое число?",
        options: ["2", "1", "3", "0"],
        correctAnswer: "2",
        category: "Математика",
        difficulty: "Легкий",
        explanation: "2 — единственное чётное простое число и наименьшее простое число."
      },
      en: {
        text: "What is the smallest prime number?",
        options: ["2", "1", "3", "0"],
        correctAnswer: "2",
        category: "Mathematics",
        difficulty: "Easy",
        explanation: "2 is the only even prime number and the smallest prime number."
      }
    }
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
    explanation: "Pifagor teoremasiga ko'ra: a² + b² = c².",
    translations: {
      ru: {
        text: "Кто автор теоремы о квадрате гипотенузы в прямоугольном треугольнике?",
        options: ["Пифагор", "Евклид", "Архимед", "Ньютон"],
        correctAnswer: "Пифагор",
        category: "Геометрия",
        difficulty: "Средний",
        explanation: "По теореме Пифагора: a² + b² = c²."
      },
      en: {
        text: "Who is the author of the theorem about the square of the hypotenuse in a right triangle?",
        options: ["Pythagoras", "Euclid", "Archimedes", "Newton"],
        correctAnswer: "Pythagoras",
        category: "Geometry",
        difficulty: "Medium",
        explanation: "By the Pythagorean theorem: a² + b² = c²."
      }
    }
  },
  {
    id: 'def_5',
    text: "Python dasturlash tilida ro'yxatga yangi element qo'shuvchi metod qaysi?",
    options: ["append()", "add()", "push()", "insert_end()"],
    correctAnswer: "append()",
    timeLimit: 30,
    category: "Dasturlash",
    difficulty: "O'rta",
    explanation: "Python'da append() metodi elementni ro'yxat oxiriga qo'shadi.",
    translations: {
      ru: {
        text: "Какой метод добавляет новый элемент в список в языке Python?",
        options: ["append()", "add()", "push()", "insert_end()"],
        correctAnswer: "append()",
        category: "Программирование",
        difficulty: "Средний",
        explanation: "В Python метод append() добавляет элемент в конец списка."
      },
      en: {
        text: "Which method adds a new element to a list in the Python programming language?",
        options: ["append()", "add()", "push()", "insert_end()"],
        correctAnswer: "append()",
        category: "Programming",
        difficulty: "Medium",
        explanation: "In Python, the append() method adds an element to the end of a list."
      }
    }
  },
  {
    id: 'def_6',
    text: "Doiraning yuzini topish formulasi qanday ifodalanadi?",
    options: ["S = πr²", "S = 2πr", "S = πd", "S = 4πr²"],
    correctAnswer: "S = πr²",
    timeLimit: 30,
    category: "Matematika",
    difficulty: "O'rta",
    explanation: "r - doira radiusi bo'lganda uning yuzi S = πr² bo'ladi.",
    translations: {
      ru: {
        text: "Какой формулой выражается площадь круга?",
        options: ["S = πr²", "S = 2πr", "S = πd", "S = 4πr²"],
        correctAnswer: "S = πr²",
        category: "Математика",
        difficulty: "Средний",
        explanation: "Если r — радиус круга, то его площадь S = πr²."
      },
      en: {
        text: "Which formula expresses the area of a circle?",
        options: ["S = πr²", "S = 2πr", "S = πd", "S = 4πr²"],
        correctAnswer: "S = πr²",
        category: "Mathematics",
        difficulty: "Medium",
        explanation: "If r is the radius of a circle, then its area is S = πr²."
      }
    }
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
    explanation: "CAP teoremasiga ko'ra (Consistency, Availability, Partition tolerance) bir vaqtning o'zida ko'pi bilan 2 ta kafolat ta'minlanadi.",
    translations: {
      ru: {
        text: "По теореме CAP в распределённых базах данных скольких из трёх гарантий можно достичь одновременно?",
        options: ["Только 2", "Всех 3", "Только 1", "Ни одной"],
        correctAnswer: "Только 2",
        category: "Информатика",
        difficulty: "Сложный",
        explanation: "По теореме CAP (Consistency, Availability, Partition tolerance) одновременно можно обеспечить не более 2 гарантий."
      },
      en: {
        text: "According to the CAP theorem in distributed databases, how many of the three guarantees can be achieved at once?",
        options: ["Only 2", "All 3", "Only 1", "None"],
        correctAnswer: "Only 2",
        category: "Computer Science",
        difficulty: "Hard",
        explanation: "According to the CAP theorem (Consistency, Availability, Partition tolerance), at most 2 guarantees can be ensured at the same time."
      }
    }
  },
  {
    id: 'def_8',
    text: "Kvadrat tenglama diskriminanti D < 0 bo'lsa, haqiqiy ildizlar soni nechta bo'ladi?",
    options: ["0 ta (haqiqiy ildizga ega emas)", "1 ta", "2 ta", "Cheksiz ko'p"],
    correctAnswer: "0 ta (haqiqiy ildizga ega emas)",
    timeLimit: 40,
    category: "Algebra",
    difficulty: "Qiyin",
    explanation: "Diskriminant manfiy bo'lsa, tenglama haqiqiy sonlar to'plamida ildizga ega bo'lmaydi (kompleks ildizlar bor).",
    translations: {
      ru: {
        text: "Если дискриминант квадратного уравнения D < 0, сколько действительных корней оно имеет?",
        options: ["0 (не имеет действительных корней)", "1", "2", "Бесконечно много"],
        correctAnswer: "0 (не имеет действительных корней)",
        category: "Алгебра",
        difficulty: "Сложный",
        explanation: "Если дискриминант отрицательный, уравнение не имеет корней на множестве действительных чисел (есть комплексные корни)."
      },
      en: {
        text: "If the discriminant of a quadratic equation is D < 0, how many real roots does it have?",
        options: ["0 (no real roots)", "1", "2", "Infinitely many"],
        correctAnswer: "0 (no real roots)",
        category: "Algebra",
        difficulty: "Hard",
        explanation: "If the discriminant is negative, the equation has no roots over the real numbers (there are complex roots)."
      }
    }
  }
];
