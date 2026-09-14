import {test, expect} from '@playwright/test';

// ---------------------------------------------------------------------------
// Social (OAuth) sign-in flow: the provider buttons on the teacher auth page
// must open the modal, create/persist an account, land on /#/game, and keep the
// account visible in the sidebar for later visits. All selectors are
// locale-independent (data-testid driven). The email renders in both the
// sidebar and the header, so assertions are scoped to the sidebar
// (role=complementary).
// ---------------------------------------------------------------------------

const baseURL = (): string =>
  process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

const sidebar = (page: import('@playwright/test').Page) => page.getByRole('complementary');

test.beforeEach(async ({page}) => {
  await page.goto(`${baseURL()}/#/teacher/auth`);
});

async function fillOAuthModal(page: import('@playwright/test').Page, name: string, email: string) {
  const dialog = page.getByRole('dialog');
  await dialog.getByTestId('oauth-name').fill(name);
  await dialog.getByTestId('oauth-email').fill(email);
  await dialog.getByTestId('oauth-submit').click();
  return dialog;
}

test('google sign-in creates an account and persists it in the sidebar', async ({page}) => {
  const email = `oauth.google.${Date.now()}@test.eduplay.uz`;

  await page.getByTestId('oauth-google').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await fillOAuthModal(page, 'OAuth Google Teacher', email);

  await page.waitForURL(/#\/game$/, {timeout: 15_000});

  await page.goto(`${baseURL()}/#/`);
  await expect(sidebar(page).getByText(email)).toBeVisible();
  await page.reload();
  await expect(sidebar(page).getByText(email)).toBeVisible();
});

test('github sign-in re-opens an existing account (same email → same id)', async ({page}) => {
  const email = `oauth.github.${Date.now()}@test.eduplay.uz`;

  await page.getByTestId('oauth-github').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await fillOAuthModal(page, 'GitHub Teacher', email);
  await page.waitForURL(/#\/game$/, {timeout: 15_000});

  await page.goto(`${baseURL()}/#/`);
  await page.getByTestId('header-logout').click();
  await expect(sidebar(page).getByText(email)).not.toBeVisible();

  await page.goto(`${baseURL()}/#/teacher/auth`);
  await page.getByTestId('oauth-github').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await fillOAuthModal(page, 'GitHub Teacher', email);
  await page.waitForURL(/#\/game$/, {timeout: 15_000});

  await page.goto(`${baseURL()}/#/`);
  await expect(sidebar(page).getByText(email)).toBeVisible();
  await expect(sidebar(page).getByText('GitHub Teacher')).toBeVisible();
});

test('apple sign-in surfaces the account card in the sidebar', async ({page}) => {
  const email = `oauth.apple.${Date.now()}@test.eduplay.uz`;

  await page.getByTestId('oauth-apple').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await fillOAuthModal(page, 'Apple Teacher', email);
  await page.waitForURL(/#\/game$/, {timeout: 15_000});

  await page.goto(`${baseURL()}/#/`);
  await expect(sidebar(page).getByText(email)).toBeVisible();
  await expect(sidebar(page).getByTestId('sidebar-logout')).toBeVisible();
});