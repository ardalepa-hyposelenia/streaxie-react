import { test as base, expect } from "@playwright/test";

// Only delivery requests are intercepted; app flows still use the test Go API.
// Never send transactional email to the generated test addresses.
export const test = base.extend({
  page: async ({ page }, use) => {
    if (process.env.TURNSTILE_TEST_UI === "1") {
      await page.route(
        "https://challenges.cloudflare.com/turnstile/v0/api.js*",
        (route) =>
          route.fulfill({
            contentType: "application/javascript",
            body: `
          let serial = 0;
          window.turnstile = {
            render(element, options) {
              const id = String(++serial);
              queueMicrotask(() => options.callback(options.action + '-test-token-' + id));
              return id;
            },
            remove() {}
          };
        `,
          }),
      );
    }
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
