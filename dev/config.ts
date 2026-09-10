import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export type Environment = Record<string, string>;

export function readEnvironment(path: string): Environment {
  if (!existsSync(path)) return {};
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--no-env-file",
      `--env-file=${path}`,
      "-e",
      "process.stdout.write(JSON.stringify(process.env))",
    ],
    { env: {}, stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0)
    throw new Error(`Cannot parse environment file: ${path}`);
  return JSON.parse(result.stdout.toString());
}

export function validateDevelopmentConfig(input: {
  settings: Environment;
  api: Environment;
  bot: Environment;
  activity: Environment;
}): Check[] {
  const { settings, api, bot, activity } = input;
  const checks: Check[] = [];
  for (const [app, values, keys] of [
    [
      "api",
      api,
      [
        "DISCORD_CLIENT_ID",
        "DISCORD_CLIENT_SECRET",
        "DISCORD_BOT_TOKEN",
        "MARQUINHOS_API_KEY",
        "MARQUINHOS_SECRET_KEY",
        "OPENAI_API_KEY",
      ],
    ],
    [
      "bot",
      bot,
      ["MARQUINHOS_CLIENT_ID", "MARQUINHOS_TOKEN", "MARQUINHOS_API_KEY"],
    ],
    ["activity", activity, ["VITE_DISCORD_CLIENT_ID"]],
  ] as const) {
    for (const key of keys)
      checks.push({
        name: `${app}: ${key}`,
        ok: Boolean(values[key]?.trim()),
        detail: `Set ${key} in apps/${app}/.env`,
      });
  }
  checks.push({
    name: "Discord application IDs",
    ok:
      Boolean(api.DISCORD_CLIENT_ID) &&
      api.DISCORD_CLIENT_ID === bot.MARQUINHOS_CLIENT_ID &&
      api.DISCORD_CLIENT_ID === activity.VITE_DISCORD_CLIENT_ID,
    detail: "API, bot and Activity must use the same development application",
  });
  checks.push({
    name: "Shared API key",
    ok:
      Boolean(api.MARQUINHOS_API_KEY) &&
      api.MARQUINHOS_API_KEY === bot.MARQUINHOS_API_KEY,
    detail: "API and bot MARQUINHOS_API_KEY must match",
  });
  checks.push({
    name: "Discord bot token",
    ok:
      Boolean(api.DISCORD_BOT_TOKEN) &&
      api.DISCORD_BOT_TOKEN === bot.MARQUINHOS_TOKEN,
    detail: "API and bot must use the development bot token",
  });
  checks.push({
    name: "Test channel",
    ok: /^\d{17,20}$/.test(settings.DEV_TEST_CHANNEL_ID ?? ""),
    detail: "Set DEV_TEST_CHANNEL_ID in dev/.env",
  });
  let validOrigin = false;
  try {
    const url = new URL(settings.DEV_PUBLIC_ORIGIN ?? "");
    validOrigin =
      url.protocol === "https:" &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password;
  } catch {}
  checks.push({
    name: "Public origin",
    ok: validOrigin,
    detail: "Set DEV_PUBLIC_ORIGIN to the HTTPS tunnel origin without a path",
  });
  for (const [key, fallback] of [
    ["DEV_API_PORT", "3000"],
    ["DEV_ACTIVITY_PORT", "5173"],
  ] as const) {
    const value = settings[key] || fallback;
    checks.push({
      name: key,
      ok: /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 65535,
      detail: `${key} must be a port from 1 to 65535`,
    });
  }
  checks.push({
    name: "Distinct host ports",
    ok:
      (settings.DEV_API_PORT || "3000") !==
      (settings.DEV_ACTIVITY_PORT || "5173"),
    detail: "API and Activity need different host ports",
  });
  checks.push({
    name: "Sandbox mirror path",
    ok: isAbsolute(settings.SANDBOX_MIRROR_PATH ?? ""),
    detail:
      "Set SANDBOX_MIRROR_PATH to an existing absolute host mirror path in dev/.env",
  });
  return checks;
}
