import {test, expect, type Page} from '@playwright/test';
import {loginOrSignupTeacher} from './auth';

// ---------------------------------------------------------------------------
// UI/UX audit вЂ” captures full-page screenshots at the 3 main breakpoints and
// reports layout anomalies (horizontal overflow, tiny fonts, undersized tap
// targets) that are visible to us even without eyeballing the PNGs.
//
// Screenshots land in test-results/ui-audit/ (gitignored).
//
// Deliberately read-only: logs in as the teacher (creating a throwaway game
// in dev-server memory) but NEVER adds questions, so questions_db.json is
// never touched.
// ---------------------------------------------------------------------------

const baseURL = (): string =>
  process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

const VIEWPORTS: Array<{name: string; width: number; height: number}> = [
  {name: '375x812-mobile', width: 375, height: 812},
  {name: '768x1024-tablet', width: 768, height: 1024},
  {name: '1440x900-desktop', width: 1440, height: 900},
];

interface Anomaly {
  type: string;
  sel: string;
  detail: string;
}

async function audit(page: Page, label: string): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  const layout = await page.evaluate(() => {
    const de = document.documentElement;
    const overflow = de.scrollWidth - window.innerWidth;
    const offscreen: string[] = [];
    const tiny = new Map<string, string>();
    const smallTargets = new Map<string, string>();
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'absolute') return;
      if (r.right > window.innerWidth + 4 || r.bottom > window.innerHeight + 2000) {
        if (el.textContent?.trim()) {
          offscreen.push(`${el.tagName.toLowerCase()}.${(el.className as string)?.toString().slice(0, 40)}`);
        }
      }
      if (r.height > 0 && r.height < 40 && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button')) {
        smallTargets.set(el.tagName.toLowerCase(), `${Math.round(r.height)}px "${el.textContent?.trim().slice(0, 24)}"`);
      }
      const fs = parseFloat(cs.fontSize);
      if (fs > 0 && fs < 12 && el.textContent?.trim() && el.tagName !== 'SCRIPT') {
        tiny.set(el.tagName.toLowerCase(), `${fs}px`);
      }
    });
    return {overflow, offscreen: offscreen.slice(0, 6), tiny: [...tiny.entries()].slice(0, 6), smallTargets: [...smallTargets.entries()].slice(0, 6)};
  });

  if (layout.overflow > 0) anomalies.push({type: 'h-overflow', sel: 'html', detail: `${layout.overflow}px`});
  layout.offscreen.forEach((o) => anomalies.push({type: 'offscreen', sel: o, detail: 'right overflow'}));
  layout.tiny.forEach(([sel, v]) => anomalies.push({type: 'tiny-font', sel, detail: v}));
  layout.smallTargets.forEach(([sel, v]) => anomalies.push({type: 'small-target', sel, detail: v}));

  return anomalies;
}

async function loginTeacher(page: Page): Promise<void> {
  await loginOrSignupTeacher(page);
  await expect(page.getByTestId('pin-value')).toHaveText(/^\d{6}$/, {timeout: 20_000});
}

test.describe.configure({mode: 'serial'});

for (const vp of VIEWPORTS) {
  test(`ui-audit @ ${vp.name}`, async ({browser}) => {
    const ctx = await browser.newContext({viewport: {width: vp.width, height: vp.height}});
    const page = await ctx.newPage();
    const issues: string[] = [];

    // --- Landing -----------------------------------------------------------
    await page.goto(`${baseURL()}/#/`);
    await page.waitForTimeout(800);
    await page.screenshot({path: `test-results/ui-audit/${vp.name}-landing.png`, fullPage: true});
    for (const a of await audit(page, 'landing')) issues.push(`LANDING    ${a.type} ${a.sel} :: ${a.detail}`);

    // --- Teacher auth ---------------------------------------------------------
    await page.goto(`${baseURL()}/#/teacher/auth`);
    await page.waitForTimeout(500);
    await page.screenshot({path: `test-results/ui-audit/${vp.name}-auth.png`, fullPage: true});
    for (const a of await audit(page, 'auth')) issues.push(`AUTH       ${a.type} ${a.sel} :: ${a.detail}`);

    // --- Teacher console (fresh game) ------------------------------------------
    await loginTeacher(page);
    await page.waitForTimeout(800);
    await page.screenshot({path: `test-results/ui-audit/${vp.name}-console.png`, fullPage: true});
    const consoleIssues = await audit(page, 'console');
    consoleIssues.forEach((a) => issues.push(`CONSOLE    ${a.type} ${a.sel} :: ${a.detail}`));

    // Create a team so the team-setup card renders.
    await page.getByTestId('team-name').fill('Audit Guruh');
    await page.getByTestId('add-team').click();
    await expect(page.getByText('Audit Guruh')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({path: `test-results/ui-audit/${vp.name}-team.png`, fullPage: true});
    for (const a of await audit(page, 'team')) issues.push(`TEAM       ${a.type} ${a.sel} :: ${a.detail}`);

    // --- Student join (fresh context, same viewport) -----------------------------
    const sCtx = await browser.newContext({viewport: {width: vp.width, height: vp.height}});
    const student = await sCtx.newPage();
    await student.goto(`${baseURL()}/#/play`);
    await student.waitForTimeout(500);
    await student.screenshot({path: `test-results/ui-audit/${vp.name}-join.png`, fullPage: true});
    for (const a of await audit(student, 'join')) issues.push(`JOIN       ${a.type} ${a.sel} :: ${a.detail}`);
    await sCtx.close();

    console.log(`== ${vp.name} ==`);
    console.log(issues.join('\n') || 'no anomalies');

    await ctx.close();
  });
}
