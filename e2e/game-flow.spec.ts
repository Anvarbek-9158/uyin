import {test, expect, type Browser, type Page, type BrowserContext} from '@playwright/test';

// ---------------------------------------------------------------------------
// End-to-end flow: TEACHER + 2 STUDENT devices against a real, running dev server.
//
// Each actor runs in its OWN browser context (separate clientId + session
// token), so the realtime path really crosses "devices" over Pusher cloud.
// A second team is required: finish-round ends the game as soon as <=1
// non-eliminated team remains (by design), so a single-team game jumps
// straight to GAME_OVER. With 2 teams that BOTH answer correctly the game
// reaches ROUND_RESULT and the round cycle (betting -> answering -> grading ->
// next question) can be exercised.
//
// The full loop covered: teacher login -> game + PIN -> create 2 teams ->
// 2 students join by PIN + assigned (first member of each team auto-becomes
// leader) -> start quiz with an existing bank question -> both leaders bet ->
// both answer -> grading -> round result -> realtime group chat both ways ->
// end game -> winners + student feedback.
//
// NOTE: the test deliberately does NOT add a question — saveQuestions persists
// to questions_db.json (which is git-tracked), and the flow works fine against
// an existing bank question (q_a: deterministic, multiple-choice).
// ---------------------------------------------------------------------------

const TEAM_ONE = 'Bunyodkor';
const TEAM_TWO = 'Pakhtakor';
const STUDENT_ONE = 'Muhammad';
const STUDENT_TWO = 'Alisher';

const baseURL = (): string =>
  process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

async function teacherLogin(browserContext: BrowserContext): Promise<Page> {
  const page = await browserContext.newPage();
  // Destructive actions use an in-app confirm Modal (no native dialogs left);
  // auto-accept any stray native dialog defensively.
  page.on('dialog', (d) => d.accept());
  await page.goto(`${baseURL()}/#/teacher/auth`);
  // Switch to the "login" tab (fewer fields than signup).
  await page.getByRole('button', {name: 'Kirish'}).click();
  await page.getByPlaceholder('siz@misol.com').fill('teacher@eduplay.uz');
  await page.getByPlaceholder('Kamida 6 belgi').fill('test-pass-123');
  await page.getByTestId('auth-submit').click();
  // AuthForm waits ~1.2s then navigates to the teacher console.
  await page.waitForURL(/#\/game$/, {timeout: 20_000});
  return page;
}

async function readPin(teacher: Page): Promise<string> {
  const el = teacher.getByTestId('pin-value');
  await expect(el).toHaveText(/^\d{6}$/, {timeout: 20_000});
  return (await el.textContent())!.trim();
}

async function studentJoins(browser: Browser, pin: string, name: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${baseURL()}/#/play`);
  await page.getByTestId('pin-input').fill(pin);
  await page.getByTestId('name-input').fill(name);
  await page.getByTestId('join-submit').click();
  // Waiting room ("Kutish Zali").
  await expect(page.getByText('Kutish Zali')).toBeVisible({timeout: 20_000});
  return page;
}

test.describe.configure({mode: 'serial'});

test('teacher + 2 students end-to-end game with realtime chat', async ({browser}) => {
  const teacherCtx = await browser.newContext();
  const teacher = await teacherLogin(teacherCtx);

  // --- 1. Game auto-created on the console; capture the PIN ---------------
  const pin = await readPin(teacher);

  // --- 2. Create two teams -------------------------------------------------
  await teacher.getByTestId('team-name').fill(TEAM_ONE);
  await teacher.getByTestId('add-team').click();
  await expect(teacher.getByText(TEAM_ONE)).toBeVisible();
  await teacher.getByTestId('team-name').fill(TEAM_TWO);
  await teacher.getByTestId('add-team').click();
  await expect(teacher.getByText(TEAM_TWO)).toBeVisible();

  // --- 3. Both students join from separate devices --------------------------
  const studentOne = await studentJoins(browser, pin, STUDENT_ONE);
  const studentTwo = await studentJoins(browser, pin, STUDENT_TWO);

  // --- 4. Assign each student to a team -------------------------------------
  // NOTE: assigning the FIRST member to a team makes them the leader
  // automatically (/api/assign-student), so there is no separate step.
  const assignSelects = teacher.getByTestId('assign-select');
  await assignSelects.first().selectOption({label: STUDENT_ONE});
  await assignSelects.nth(1).selectOption({label: STUDENT_TWO});
  // Both waiting-room headers show the joined team chip + the leader badge.
  await expect(studentOne.getByText(TEAM_ONE)).toBeVisible({timeout: 15_000});
  await expect(studentOne.getByText("Guruh Boshlig'i")).toBeVisible({timeout: 15_000});
  await expect(studentTwo.getByText(TEAM_TWO)).toBeVisible({timeout: 15_000});
  await expect(studentTwo.getByText("Guruh Boshlig'i")).toBeVisible({timeout: 15_000});

  // --- 5. Start the quiz: pick the first bank question (q_a) -----------------
  await teacher.getByTestId('start-quiz').click();
  await teacher.getByTestId('q-start').first().click();
  // Teacher console switches LOBBY -> BETTING (ActiveGamePanel appears).
  await expect(teacher.getByTestId('start-answering')).toBeVisible({timeout: 20_000});
  // Both students see the betting panel.
  await expect(studentOne.getByRole('button', {name: /Ball Tikishni Tasdiqlash/})).toBeVisible({
    timeout: 20_000,
  });
  await expect(studentTwo.getByRole('button', {name: /Ball Tikishni Tasdiqlash/})).toBeVisible({
    timeout: 20_000,
  });

  // --- 6. Both leaders place their bets --------------------------------------
  await studentOne.getByRole('button', {name: /Ball Tikishni Tasdiqlash/}).click();
  await studentTwo.getByRole('button', {name: /Ball Tikishni Tasdiqlash/}).click();
  await expect(teacher.getByText(/2\/2/)).toBeVisible({timeout: 15_000});

  // --- 7. Teacher reveals the question; both leaders answer ------------------
  await teacher.getByTestId('start-answering').click();
  // q_a has two options index(0)="A" (correct), index(1)="B"; both pick option 0.
  for (const student of [studentOne, studentTwo]) {
    await expect(student.getByTestId('option-0')).toBeVisible({timeout: 15_000});
    await student.getByTestId('option-0').click();
  }
  await expect(teacher.getByText(/Yuborildi/).first()).toBeVisible({timeout: 15_000});

  // --- 8. Teacher grades the first team; finish-round auto-grades the 2nd ----
  // (timer auto-transitions ANSWERING -> GRADING at 20s; the button then appears)
  await expect(teacher.getByTestId('grade-correct').first()).toBeVisible({timeout: 25_000});
  await teacher.getByTestId('grade-correct').first().click();
  await teacher.getByTestId('finish-round').click();
  // 2 non-eliminated teams -> ROUND_RESULT (not GAME_OVER), round advances.
  await expect(teacher.getByTestId('next-question')).toBeVisible({timeout: 20_000});
  // Students see the round result / correct answer block.
  await expect(studentOne.getByText('A').first()).toBeVisible({timeout: 20_000});
  await expect(studentTwo.getByText('A').first()).toBeVisible({timeout: 20_000});

  // --- 9. Realtime group chat: teacher -> group -> student, then reply ------
  await teacher.getByTestId('chat-launcher').click();
  await expect(teacher.getByTestId('chat-input')).toBeVisible();
  await teacher.getByTestId('chat-input').fill('Salom guruhlar!');
  await teacher.getByTestId('chat-send').click();
  // Teacher panel shows its own sent bubble.
  await expect(teacher.getByText('Salom guruhlar!', {exact: true})).toBeVisible({timeout: 15_000});

  await studentOne.getByTestId('chat-launcher').click();
  await expect(studentOne.getByTestId('chat-input')).toBeVisible({timeout: 15_000});
  // Student switches from the private tab to the group tab.
  await studentOne.getByRole('button', {name: /Guruh chati/}).click();
  await expect(studentOne.getByText('Salom guruhlar!', {exact: true})).toBeVisible({timeout: 20_000});
  // Student replies; the message must reach the teacher's open group panel.
  await studentOne.getByTestId('chat-input').fill('Rahmat!');
  await studentOne.getByTestId('chat-send').click();
  await expect(teacher.getByText('Rahmat!', {exact: true})).toBeVisible({timeout: 20_000});

  // --- 10. End the game and announce winners --------------------------------
  await teacher.getByTestId('end-game').click();
  // The destructive action is confirmed through the in-app confirm Modal.
  await teacher.getByRole('button', {name: 'Tasdiqlash'}).click();
  await expect(teacher.getByText(/[G\u2018']olib/)).toBeVisible({timeout: 20_000});

  // --- 11. Student sees Game Over + submits feedback -------------------------
  for (const student of [studentOne, studentTwo]) {
    await expect(student.getByText("O'yin Yakunlandi!")).toBeVisible({timeout: 20_000});
  }
  await studentOne.getByPlaceholder(/Dars va viktorina/).fill('Juda zo\u2018r bo\u2018ldi!');
  await studentOne.getByRole('button', {name: /Fikrimni Yuborish/}).click();
  await expect(studentOne.getByText(/Rahmat! Fikringiz/)).toBeVisible({timeout: 15_000});

  // --- 12. Teacher feedback inbox shows the new feedback ---------------------
  await expect(teacher.getByRole('button', {name: /\(1\)/})).toBeVisible({timeout: 15_000});

  await teacherCtx.close();
  await studentOne.context().close();
  await studentTwo.context().close();
});