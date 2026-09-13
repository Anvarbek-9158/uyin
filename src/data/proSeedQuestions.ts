import { Question } from '../types';
import { DEFAULT_QUESTIONS } from './defaultQuestions';

// ============================================================
// Reserved PRO account(s) and their starter question banks.
//
// Per-account isolation (see server/state.ts): every teacher account owns a
// private question bank that starts EMPTY — except the reserved accounts below,
// which are seeded with a curated starter set on their first game. The email
// allowlist is also used to grant the 'pro' plan at signup/login. Keys are
// lowercased (the auth layer normalizes emails before storage/lookup).
// ============================================================

export const PRO_ACCOUNT_EMAILS: string[] = ['anvarbekomonov8@gmail.com'];

// def_9..def_15 complete the starter set to a full 15-question bank (8 proven
// defaults + 7 new), all with the same trilingual (uz/ru/en) style.
const ADDITIONAL_STARTER_QUESTIONS: Question[] = [
  {
    id: 'def_9',
    text: '12 va 18 sonlarining eng kichik umumiy karralisi (EKUK) nimaga teng?',
    options: ['36', '6', '24', '72'],
    correctAnswer: '36',
    timeLimit: 25,
    category: 'Matematika',
    difficulty: 'Oson',
    explanation: '12 va 18 ning bo\'linuvchilarini solishtirsak, ularning eng kichik umumiy karralisi 36 (9 x 4 = 12 x 3).',
    translations: {
      ru: {
        text: 'Чему равно наименьшее общее кратное (НОК) чисел 12 и 18?',
        options: ['36', '6', '24', '72'],
        correctAnswer: '36',
        category: 'Математика',
        difficulty: 'Легкий',
        explanation: 'Наименьшее общее кратное 12 и 18 равно 36.'
      },
      en: {
        text: 'What is the least common multiple (LCM) of 12 and 18?',
        options: ['36', '6', '24', '72'],
        correctAnswer: '36',
        category: 'Mathematics',
        difficulty: 'Easy',
        explanation: 'The least common multiple of 12 and 18 is 36.'
      }
    }
  },
  {
    id: 'def_10',
    text: 'HTML tilida matnni QALIN qilib ko\'rsatuvchi teg qaysi?',
    options: ['<b>', '<i>', '<u>', '<em>'],
    correctAnswer: '<b>',
    timeLimit: 20,
    category: 'Informatika',
    difficulty: 'Oson',
    explanation: '<b> (bold) tegi matnni qalin uslubda ko\'rsatadi.',
    translations: {
      ru: {
        text: 'Какой тег в HTML делает текст ЖИРНЫМ?',
        options: ['<b>', '<i>', '<u>', '<em>'],
        correctAnswer: '<b>',
        category: 'Информатика',
        difficulty: 'Легкий',
        explanation: 'Тег <b> (bold) отображает текст жирным начертанием.'
      },
      en: {
        text: 'Which HTML tag makes text BOLD?',
        options: ['<b>', '<i>', '<u>', '<em>'],
        correctAnswer: '<b>',
        category: 'Computer Science',
        difficulty: 'Easy',
        explanation: 'The <b> (bold) tag displays text in a bold style.'
      }
    }
  },
  {
    id: 'def_11',
    text: 'Aylana uzunligi qaysi formula bilan hisoblanadi?',
    options: ['C = 2πr', 'C = πr²', 'C = 4πr', 'C = 2πr²'],
    correctAnswer: 'C = 2πr',
    timeLimit: 25,
    category: 'Geometriya',
    difficulty: 'Oson',
    explanation: 'Aylana uzunligi C = 2πr, bu yerda r — radius.',
    translations: {
      ru: {
        text: 'Какой формулой вычисляется длина окружности?',
        options: ['C = 2πr', 'C = πr²', 'C = 4πr', 'C = 2πr²'],
        correctAnswer: 'C = 2πr',
        category: 'Геометрия',
        difficulty: 'Легкий',
        explanation: 'Длина окружности C = 2πr, где r — радиус.'
      },
      en: {
        text: 'Which formula gives the circumference of a circle?',
        options: ['C = 2πr', 'C = πr²', 'C = 4πr', 'C = 2πr²'],
        correctAnswer: 'C = 2πr',
        category: 'Geometry',
        difficulty: 'Easy',
        explanation: 'The circumference is C = 2πr, where r is the radius.'
      }
    }
  },
  {
    id: 'def_12',
    text: 'Ikkilik sanoq sistemasidagi 1010 soni o\'nlik sistemada qancha?',
    options: ['10', '12', '1010', '20'],
    correctAnswer: '10',
    timeLimit: 30,
    category: 'Informatika',
    difficulty: "O'rta",
    explanation: '1010₂ = 1·8 + 0·4 + 1·2 + 0·1 = 10.',
    translations: {
      ru: {
        text: 'Сколько будет число 1010 в двоичной системе счисления в десятичной?',
        options: ['10', '12', '1010', '20'],
        correctAnswer: '10',
        category: 'Информатика',
        difficulty: 'Средний',
        explanation: '1010₂ = 1·8 + 0·4 + 1·2 + 0·1 = 10.'
      },
      en: {
        text: 'What is the binary number 1010 in decimal?',
        options: ['10', '12', '1010', '20'],
        correctAnswer: '10',
        category: 'Computer Science',
        difficulty: 'Medium',
        explanation: '1010₂ = 1·8 + 0·4 + 1·2 + 0·1 = 10.'
      }
    }
  },
  {
    id: 'def_13',
    text: 'Saralangan massivda ikkilik qidiruv algoritmining vaqt murakkabligi qanday?',
    options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(n²)'],
    correctAnswer: 'O(log n)',
    timeLimit: 40,
    category: 'Dasturlash',
    difficulty: 'Qiyin',
    explanation: 'Har qadamda qidiruv oralig\'i ikki baravar kamayadi — logarifmik murakkablik.',
    translations: {
      ru: {
        text: 'Какова временная сложность бинарного поиска в отсортированном массиве?',
        options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(n²)'],
        correctAnswer: 'O(log n)',
        category: 'Программирование',
        difficulty: 'Сложный',
        explanation: 'На каждом шаге область поиска уменьшается вдвое — логарифмическая сложность.'
      },
      en: {
        text: 'What is the time complexity of binary search on a sorted array?',
        options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(n²)'],
        correctAnswer: 'O(log n)',
        category: 'Programming',
        difficulty: 'Hard',
        explanation: 'Each step halves the search range — logarithmic complexity.'
      }
    }
  },
  {
    id: 'def_14',
    text: 'x² − 5x + 6 = 0 tenglamaning ildizlari qaysi?',
    options: ['2 va 3', '1 va 6', '-2 va -3', '0 va 5'],
    correctAnswer: '2 va 3',
    timeLimit: 35,
    category: 'Algebra',
    difficulty: "O'rta",
    explanation: 'x² − 5x + 6 = (x − 2)(x − 3), demak ildizlar 2 va 3.',
    translations: {
      ru: {
        text: 'Каковы корни уравнения x² − 5x + 6 = 0?',
        options: ['2 и 3', '1 и 6', '-2 и -3', '0 и 5'],
        correctAnswer: '2 и 3',
        category: 'Алгебра',
        difficulty: 'Средний',
        explanation: 'x² − 5x + 6 = (x − 2)(x − 3), значит корни 2 и 3.'
      },
      en: {
        text: 'What are the roots of the equation x² − 5x + 6 = 0?',
        options: ['2 and 3', '1 and 6', '-2 and -3', '0 and 5'],
        correctAnswer: '2 and 3',
        category: 'Algebra',
        difficulty: 'Medium',
        explanation: 'x² − 5x + 6 = (x − 2)(x − 3), so the roots are 2 and 3.'
      }
    }
  },
  {
    id: 'def_15',
    text: 'HTTP protokoli odatda qaysi portda ishlaydi?',
    options: ['80', '21', '443', '25'],
    correctAnswer: '80',
    timeLimit: 25,
    category: 'Informatika',
    difficulty: "O'rta",
    explanation: 'HTTP uchun standart port 80 (HTTPS — 443).',
    translations: {
      ru: {
        text: 'На каком порту обычно работает протокол HTTP?',
        options: ['80', '21', '443', '25'],
        correctAnswer: '80',
        category: 'Информатика',
        difficulty: 'Средний',
        explanation: 'Стандартный порт HTTP — 80 (HTTPS — 443).'
      },
      en: {
        text: 'Which port does the HTTP protocol typically use?',
        options: ['80', '21', '443', '25'],
        correctAnswer: '80',
        category: 'Computer Science',
        difficulty: 'Medium',
        explanation: 'The standard HTTP port is 80 (HTTPS — 443).'
      }
    }
  },
];

// Seed map: account email (lowercased) -> its starter question bank.
export const SEED_QUESTIONS_BY_EMAIL: Record<string, Question[]> = Object.fromEntries(
  PRO_ACCOUNT_EMAILS.map((email) => [
    email,
    [...DEFAULT_QUESTIONS, ...ADDITIONAL_STARTER_QUESTIONS],
  ])
) as Record<string, Question[]>;

export function isProEmail(email: string): boolean {
  return PRO_ACCOUNT_EMAILS.includes(email);
}