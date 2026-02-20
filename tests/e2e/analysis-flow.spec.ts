import { test, expect } from "@playwright/test";

test.describe("Valid8 Analysis Flow @e2e", () => {
  test("page loads and shows idea input", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("full analysis flow: input → steps → verdict → chat", async ({ page }) => {
    test.setTimeout(120_000); // Allow up to 2 minutes for real API calls

    await page.goto("/");

    // Fill in idea and submit
    await page.locator("textarea").fill("GitHub PR 자동 리뷰 봇 - AI로 코드 리뷰 코멘트를 자동 생성");
    await page.locator('button[type="submit"]').click();

    // Step card (or initial loading skeleton) should appear
    await expect(page.locator(".step-card").first()).toBeVisible({ timeout: 10_000 });

    // Wait for all 3 steps to complete (VerdictCard appears last)
    await expect(
      page.locator("text=/GO|PIVOT|KILL|FORK/").first()
    ).toBeVisible({ timeout: 90_000 });

    // ChatPanel should appear after completion
    await expect(page.locator("text=AI 후속 상담")).toBeVisible({ timeout: 10_000 });
  });
});
