import { test as base, expect } from "@playwright/test";

// Only delivery requests are intercepted; app flows still use the test Go API.
// Never send transactional email to the generated test addresses.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/api/v1/auth/resend-verification", (route) =>
      route.fulfill({
        status: 202,
        json: { message: "Verification email sent. Check your inbox." },
      }),
    );
    await use(page);
  },
});
export { expect };
