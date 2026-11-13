import { expect, test } from "./fixtures";
const password = "correct horse battery staple";
test("real API: signup, onboarding, card check-ins, offline reload, insights and archive", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "A simpler way to track your daily habits.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start your first habit" }).click();
  await page
    .getByLabel("Email", { exact: true })
    .fill(`web-${Date.now()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "First, let’s set your day." }),
  ).toBeVisible();
  await page.getByLabel("Your timezone").fill("UTC");
  await page.getByRole("button", { name: "Confirm my day" }).click();
  await page.getByRole("button", { name: "Create your first habit" }).click();
  await page.getByLabel("What would you like to make a habit?").fill("Read");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Create habit", exact: true }).click();
  const read = page
    .locator(".habit-card")
    .filter({ has: page.getByRole("heading", { name: "Read", exact: true }) });
  await expect(read).toBeVisible();
  await read.getByRole("button", { name: /Read, 0 day streak/ }).click();
  await expect(read.locator(".streak")).toContainText("1");
  await expect(read.locator(".habit-footer")).toContainText("Saved", {
    timeout: 15000,
  });
  await page.getByRole("button", { name: "New habit" }).click();
  await page.getByLabel("What would you like to make a habit?").fill("Water");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: /An amount/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Target amount").fill("2000");
  await page.getByLabel("Unit", { exact: true }).fill("ml");
  await page.getByLabel("Allow some flexibility").check();
  await page.getByLabel("Flexibility (same unit)").fill("300");
  await page.getByRole("button", { name: "Create habit", exact: true }).click();
  const water = page
    .locator(".habit-card")
    .filter({ has: page.getByRole("heading", { name: "Water", exact: true }) });
  await water.getByRole("button", { name: /Water, 0 day streak/ }).click();
  await water.getByLabel("Amount (ml)").fill("1800");
  await water.getByRole("button", { name: "Save", exact: true }).click();
  await expect(water.locator(".streak")).toContainText("1");
  await expect(water.locator(".habit-footer")).toContainText("Saved", {
    timeout: 15000,
  });
  await page.getByRole("button", { name: "New habit" }).click();
  await page.getByLabel("What would you like to make a habit?").fill("Sleep");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: /A time of day/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Target time").fill("21:00");
  await page.getByLabel("Which day is the target on?").selectOption("-1");
  await page.getByRole("button", { name: "Create habit", exact: true }).click();
  const sleep = page
    .locator(".habit-card")
    .filter({ has: page.getByRole("heading", { name: "Sleep", exact: true }) });
  await sleep.locator(".card-activation").focus();
  await page.keyboard.press("Enter");
  await sleep.getByLabel("Actual time").fill("00:30");
  await sleep
    .getByLabel("Date it happened")
    .fill(new Date().toISOString().slice(0, 10));
  await sleep.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sleep.locator(".habit-value")).toContainText("Outside target");
  await expect(sleep.locator(".habit-footer")).toContainText("Saved");
  await page.screenshot({
    path: "test-results/today-desktop.png",
    fullPage: true,
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await read.getByRole("button", { name: /Read, 1 day streak/ }).click();
  await expect(read.locator(".streak")).toContainText("0");
  await expect(read.locator(".habit-footer")).toContainText("Pending sync");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await expect(read.locator(".habit-footer")).toContainText("Pending sync");
  await context.setOffline(false);
  await expect(read.locator(".habit-footer")).toContainText("Saved", {
    timeout: 20000,
  });
  await expect(read.locator(".streak")).toContainText("0");
  await page.getByRole("link", { name: "Insights", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Check-in history" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Not checked in");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page
    .locator(".manage-habit")
    .filter({ has: page.getByText("Read", { exact: true }) })
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await page.getByRole("button", { name: "Open archive" }).click();
  await expect(page.locator(".manage-habit")).toContainText("Read");
  await page
    .locator(".manage-habit")
    .getByRole("button", { name: "Edit habit" })
    .click();
  await page.getByLabel("Habit name").fill("Read more");
  await page.getByRole("button", { name: "Save habit", exact: true }).click();
  await expect(page.locator(".manage-habit")).toContainText("Read more");
  await page
    .locator(".manage-habit")
    .getByRole("button", { name: "Restore" })
    .click();
  await expect(page.getByText("No archived habits.")).toBeVisible();
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".app-nav")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/today-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
