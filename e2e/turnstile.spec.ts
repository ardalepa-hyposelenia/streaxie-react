import { expect, test } from "./fixtures";

test.skip(
  process.env.TURNSTILE_TEST_UI !== "1",
  "Requires a local build with a Turnstile site key and intercepted provider script",
);

test("password recovery replaces the single-use challenge after a rejected request", async ({
  page,
}) => {
  const tokens: string[] = [];
  await page.route("**/api/v1/auth/forgot-password", async (route) => {
    tokens.push(route.request().headers()["x-turnstile-token"]);
    await route.fulfill(
      tokens.length === 1
        ? {
            status: 503,
            json: {
              code: "CHALLENGE_UNAVAILABLE",
              message: "Please try again.",
            },
          }
        : { status: 202, json: { message: "Check your inbox." } },
    );
  });
  await page.goto("/forgot-password");
  await page
    .getByLabel("Email", { exact: true })
    .fill("challenge@example.test");
  const submit = page.getByRole("button", {
    name: "Send reset link",
    exact: true,
  });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(
    page.getByText("Please try again.", { exact: true }),
  ).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(
    page.getByText("Check your inbox.", { exact: true }),
  ).toBeVisible();
  expect(tokens).toHaveLength(2);
  expect(tokens[0]).toMatch(/^forgot-test-token-/);
  expect(tokens[1]).not.toBe(tokens[0]);
});

test("a failed provider script can be retried before registration", async ({
  page,
}) => {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js*",
    (route) => route.abort(),
    { times: 1 },
  );
  await page.goto("/register");
  const submit = page.getByRole("button", {
    name: "Create account",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Retry security check" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry security check" }).click();
  await expect(submit).toBeEnabled();
});
