import {type Page} from '@playwright/test';

// ---------------------------------------------------------------------------
// Real-account teacher sign-in for the e2e suite.
//
// The suite runs against ONE dev server, so a Real account (email+password,
// persisted server-side) survives across the whole run. Which spec runs first
// is not guaranteed, so this helper is idempotent:
//   1. try signup,
//   2. if the account already exists (the signup is rejected), log in instead.
// ---------------------------------------------------------------------------

const TEACHER_NAME = 'E2E Teacher';
const TEACHER_EMAIL = 'teacher@eduplay.uz';
const TEACHER_PASS = 'test-pass-123';

const baseURL = (): string =>
  process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

export async function loginOrSignupTeacher(page: Page): Promise<void> {
  await page.goto(`${baseURL()}/#/teacher/auth`);
  // The auth form starts in "signup" mode by default.
  await page.getByPlaceholder("To'liq ismingiz").fill(TEACHER_NAME);
  await page.getByPlaceholder('siz@misol.com').fill(TEACHER_EMAIL);
  await page.getByPlaceholder('Kamida 8 belgi').fill(TEACHER_PASS);
  await page.getByTestId('auth-submit').click();

  const signedUp = await page
    .waitForURL(/#\/game$/, {timeout: 10_000})
    .then(() => true)
    .catch(() => false);
  if (signedUp) {
    // Fresh server: the signup created a brand-new account.
    return;
  }

  // The account already exists from an earlier spec -> use the login form.
  await page.getByRole('button', {name: 'Kirish'}).click();
  await page.getByPlaceholder('siz@misol.com').fill(TEACHER_EMAIL);
  await page.getByPlaceholder('Kamida 8 belgi').fill(TEACHER_PASS);
  await page.getByTestId('auth-submit').click();
  await page.waitForURL(/#\/game$/, {timeout: 20_000});
}