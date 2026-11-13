import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
const password = "correct horse battery staple";
async function register(page: Page, email: string, title?: string) {
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "First, let’s set your day." }),
  ).toBeVisible();
  if (!title) return;
  await page.getByLabel("Your timezone").fill("UTC");
  await page.getByRole("button", { name: "Confirm my day" }).click();
  await page.getByRole("button", { name: "Create your first habit" }).click();
  await page.getByLabel("What would you like to make a habit?").fill(title);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Create habit", exact: true }).click();
  await expect(page.locator(".habit-card")).toContainText(title);
}
async function login(page: Page, email: string, pass = password) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
test("logout retains the queue and another account never sends it", async ({
  page,
}) => {
  const emailA = `queue-a-${Date.now()}@example.test`,
    emailB = `queue-b-${Date.now()}@example.test`;
  await register(page, emailA, "Account A habit");
  const ownerA = await page.evaluate(() =>
    localStorage.getItem("streaxie.active"),
  );
  await page.route("**/api/v1/habits/*/logs/*", (route) => route.abort());
  await page.locator(".card-activation").click();
  await expect(page.locator(".habit-footer")).toContainText("Pending sync");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Some check-ins are still pending" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out and keep pending" }).click();
  await expect(
    page.getByRole("button", { name: "Start your first habit" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/habits/*/logs/*");
  await register(page, emailB, "Account B habit");
  await expect(page.locator(".habit-list")).not.toContainText(
    "Account A habit",
  );
  const queue = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("streaxie", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return new Promise<{ owner: string }[]>((resolve) => {
      const r = db.transaction("pending").objectStore("pending").getAll();
      r.onsuccess = () => resolve(r.result);
    });
  });
  expect(queue).toHaveLength(1);
  expect(queue[0].owner).toBe(ownerA);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, emailA);
  await expect(page.locator(".habit-card")).toContainText("Account A habit");
  await expect(page.locator(".habit-footer")).toContainText("Saved", {
    timeout: 20000,
  });
  await expect(page.locator(".streak")).toContainText("1");
});
test("email link forms handle verification, reuse rejection and password reset", async ({
  page,
}) => {
  const email = `links-${Date.now()}@example.test`;
  // Exercise email form states without sending email or bypassing production
  // delivery configuration. Token/session behavior is covered by Go HTTP tests.
  let verified = false;
  await page.route("**/api/v1/auth/verify-email", async (route) => {
    await route.fulfill(
      verified
        ? {
            status: 401,
            json: {
              code: "INVALID_CREDENTIALS",
              message: "This link has already been used.",
            },
          }
        : { status: 204 },
    );
    verified = true;
  });
  await page.route("**/api/v1/auth/forgot-password", (route) =>
    route.fulfill({
      status: 202,
      json: {
        message:
          "If that account exists, a password reset email has been sent.",
      },
    }),
  );
  await page.route("**/api/v1/auth/reset-password", (route) =>
    route.fulfill({ status: 204 }),
  );
  await register(page, email);
  const verify = "/verify-email#token=" + "v".repeat(43);
  await page.goto(verify);
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Email verified");
  await page.goto(verify);
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If that account exists",
  );
  const reset = "/reset-password#token=" + "r".repeat(43);
  await page.goto(reset);
  await page
    .getByLabel("Password", { exact: true })
    .fill("a different memorable password");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
