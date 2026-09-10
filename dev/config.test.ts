import { expect, test } from "bun:test";
import { validateDevelopmentConfig } from "./config";

test("reports mismatched credentials and missing test channel without disclosing values", () => {
  const checks = validateDevelopmentConfig({
    settings: { DEV_PUBLIC_ORIGIN: "https://local.example.com" },
    api: { DISCORD_CLIENT_ID: "api-id", MARQUINHOS_API_KEY: "private-api-key" },
    bot: {
      MARQUINHOS_CLIENT_ID: "bot-id",
      MARQUINHOS_API_KEY: "private-bot-key",
    },
    activity: { VITE_DISCORD_CLIENT_ID: "activity-id" },
  });
  expect(
    checks.some(
      (check) => !check.ok && check.name === "Discord application IDs",
    ),
  ).toBe(true);
  expect(
    checks.some((check) => !check.ok && check.name === "Shared API key"),
  ).toBe(true);
  expect(
    checks.some((check) => !check.ok && check.name === "Test channel"),
  ).toBe(true);
  expect(JSON.stringify(checks)).not.toContain("private-api-key");
  expect(JSON.stringify(checks)).not.toContain("private-bot-key");
});

test("accepts matching development settings and rejects malformed public origins and ports", () => {
  const settings = {
    DEV_PUBLIC_ORIGIN: "https://dev.example.com",
    DEV_TEST_CHANNEL_ID: "123456789012345678",
    SANDBOX_MIRROR_PATH: "/tmp/mirror",
  };
  const input = {
    settings,
    api: {
      DISCORD_CLIENT_ID: "app",
      DISCORD_CLIENT_SECRET: "secret",
      DISCORD_BOT_TOKEN: "token",
      MARQUINHOS_API_KEY: "key",
      MARQUINHOS_SECRET_KEY: "secret",
      OPENAI_API_KEY: "key",
    },
    bot: {
      MARQUINHOS_CLIENT_ID: "app",
      MARQUINHOS_TOKEN: "token",
      MARQUINHOS_API_KEY: "key",
    },
    activity: { VITE_DISCORD_CLIENT_ID: "app" },
  };
  expect(validateDevelopmentConfig(input).every((check) => check.ok)).toBe(
    true,
  );
  const invalid = validateDevelopmentConfig({
    ...input,
    settings: {
      ...settings,
      DEV_PUBLIC_ORIGIN: "http://dev.example.com/api",
      DEV_API_PORT: "abc",
      DEV_ACTIVITY_PORT: "70000",
    },
  });
  expect(
    invalid.filter((check) => !check.ok).map((check) => check.name),
  ).toEqual(["Public origin", "DEV_API_PORT", "DEV_ACTIVITY_PORT"]);
});
