const reviewFrame = 'iframe[name="chapter-review"]';

export function activate(locator, touch = false) {
  return touch ? locator.tap() : locator.click();
}

// These regression fixtures start with an existing archive. The real title
// button resumes the expedition directly on the riverbank.
export async function enterRiverbank(page, touch = false) {
  await activate(page.locator('#enter'), touch);
  await page.locator('body[data-mode="travel"] #review-travel').waitFor({timeout: 90000});
}

export async function openChapterList(page, touch = false) {
  await activate(page.locator('#review-travel'), touch);
  const list = page.locator('#review-panel[open]');
  await list.waitFor();
  return list;
}

export async function selectChapter(page, id, touch = false) {
  await activate(page.locator('#review-panel[open]').locator('[data-review="' + id + '"]'), touch);
  return activeReview(page);
}

export async function activeReview(page) {
  const host = page.locator(reviewFrame);
  await host.waitFor({timeout: 60000});
  // Waiting on a frame locator also handles the initial about:blank document.
  await host.contentFrame().locator('body[data-mode="activity"]').waitFor({timeout: 60000});
  return page.frame({name:'chapter-review'});
}

export async function returnedToRiverbank(page) {
  await page.locator(reviewFrame).waitFor({state:'detached'});
  await page.locator('body[data-mode="travel"]:not([data-review-paused]) #review-travel').waitFor();
}
