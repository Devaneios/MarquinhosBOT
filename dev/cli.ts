import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  readEnvironment,
  validateDevelopmentConfig,
  type Check,
} from "./config";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, "dev/.env");
const settings = readEnvironment(envPath);
const composeArgs = [
  "docker",
  "compose",
  "--env-file",
  existsSync(envPath) ? envPath : resolve(root, "dev/.env.example"),
  "-f",
  resolve(root, "dev/compose.yml"),
];

async function command(args: string[], capture = false) {
  const child = Bun.spawn(args, {
    cwd: root,
    env: {
      ...process.env,
      DEV_PUBLIC_ORIGIN:
        settings.DEV_PUBLIC_ORIGIN || "https://marquinhos-local.frois.net.br",
      DEV_TEST_CHANNEL_ID: settings.DEV_TEST_CHANNEL_ID || "",
      DEV_API_PORT: settings.DEV_API_PORT || "3000",
      DEV_ACTIVITY_PORT: settings.DEV_ACTIVITY_PORT || "5173",
      SANDBOX_MIRROR_PATH: settings.SANDBOX_MIRROR_PATH || "",
    },
    stdin: capture ? "ignore" : "inherit",
    stdout: capture ? "pipe" : "inherit",
    stderr: capture ? "pipe" : "inherit",
  });
  const [code, output] = await Promise.all([
    child.exited,
    capture ? new Response(child.stdout).text() : Promise.resolve(""),
    capture ? new Response(child.stderr).text() : Promise.resolve(""),
  ]);
  return { code, output };
}

async function compose(args: string[], capture = false) {
  return command([...composeArgs, ...args], capture);
}

function configurationChecks(): Check[] {
  const checks = validateDevelopmentConfig({
    settings,
    api: readEnvironment(resolve(root, "apps/api/.env")),
    bot: readEnvironment(resolve(root, "apps/bot/.env")),
    activity: readEnvironment(resolve(root, "apps/activity/.env")),
  });
  const mirror = settings.SANDBOX_MIRROR_PATH;
  checks.push({
    name: "Sandbox mirror directory",
    ok: Boolean(mirror && existsSync(mirror) && statSync(mirror).isDirectory()),
    detail:
      "The configured sandbox mirror directory must already exist on this host",
  });
  return checks;
}

function report(checks: Check[]) {
  for (const check of checks)
    console.log(
      `${check.ok ? "PASS" : "FAIL"} ${check.name}${check.ok ? "" : `: ${check.detail}`}`,
    );
  return checks.every((check) => check.ok);
}

async function httpCheck(
  name: string,
  url: string,
  html: boolean,
  headers?: HeadersInit,
): Promise<Check> {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
    const body = await response.text();
    const ok =
      response.ok &&
      (html
        ? response.headers.get("content-type")?.includes("text/html") &&
          body.includes("/@vite/client")
        : response.headers.get("content-type")?.includes("application/json") &&
          JSON.parse(body).status === "ok");
    const reason = body.includes("Blocked request")
      ? "Vite rejected the tunnel hostname; check DEV_PUBLIC_ORIGIN"
      : html && body.includes("Route not found")
        ? "Tunnel reaches the API; point it to http://activity:5173"
        : `HTTP ${response.status}; check service health and gateway proxy configuration`;
    return { name, ok: Boolean(ok), detail: reason };
  } catch {
    return {
      name,
      ok: false,
      detail: "Endpoint unavailable or returned an invalid response",
    };
  }
}

async function doctor() {
  let ok = report(configurationChecks());
  const docker = await command(["docker", "info"], true);
  ok =
    report([
      {
        name: "Docker daemon",
        ok: docker.code === 0,
        detail: "Start Docker and grant this user Docker socket access",
      },
    ]) && ok;
  const origin = URL.canParse(settings.DEV_PUBLIC_ORIGIN ?? "")
    ? settings.DEV_PUBLIC_ORIGIN
    : undefined;
  const local = `http://127.0.0.1:${settings.DEV_ACTIVITY_PORT || "5173"}`;
  const checks = await Promise.all([
    httpCheck(
      "API health",
      `http://127.0.0.1:${settings.DEV_API_PORT || "3000"}/api/health`,
      false,
    ),
    httpCheck("Activity HTML", local, true),
    httpCheck("Gateway API proxy", `${local}/api/health`, false),
    ...(origin
      ? [
          httpCheck("Tunnel Activity HTML", origin, true),
          httpCheck("Tunnel API proxy", `${origin}/api/health`, false),
          httpCheck("Vite tunnel hostname", local, true, {
            Host: new URL(origin).host,
          }),
        ]
      : []),
  ]);
  ok = report(checks) && ok;
  if (docker.code === 0) {
    const bot = await compose(
      [
        "exec",
        "-T",
        "bot",
        "curl",
        "--fail",
        "--silent",
        "http://127.0.0.1:3001/healthz",
      ],
      true,
    );
    const sandbox = await command(
      ["docker", "image", "inspect", "marquinhos-sandbox:dev"],
      true,
    );
    const socket = await compose(
      ["exec", "-T", "api", "docker", "info", "--format", "{{.ServerVersion}}"],
      true,
    );
    ok =
      report([
        {
          name: "Bot Discord readiness",
          ok: bot.code === 0 && bot.output.trim() === "ok",
          detail: "Inspect bot logs for token, intents or login errors",
        },
        {
          name: "Sandbox image",
          ok: sandbox.code === 0,
          detail: "Run bun run dev to build marquinhos-sandbox:dev",
        },
        {
          name: "API Docker socket access",
          ok: socket.code === 0,
          detail: "API must be running with the host Docker socket mounted",
        },
      ]) && ok;
  }
  return ok ? 0 : 1;
}

async function main() {
  const action = process.argv[2];
  if (action === "doctor") return doctor();
  if (action === "down") return (await compose(["down"])).code;
  if (action === "test") {
    const build = await compose(["build", "tests"]);
    return (
      build.code || (await compose(["run", "--rm", "--no-deps", "tests"])).code
    );
  }
  if (action !== "up" && action !== "register")
    throw new Error("Expected up, down, doctor, register or test");
  const checks = configurationChecks();
  const relevant =
    action === "register"
      ? checks.filter(
          (check) =>
            check.name.startsWith("bot:") ||
            check.name === "Discord application IDs" ||
            check.name === "Test channel",
        )
      : checks;
  if (!report(relevant)) return 1;
  if (action === "register") {
    console.log(
      "Registering commands for the development application configured in apps/bot/.env.",
    );
    const build = await compose(["build", "bot"]);
    return (
      build.code ||
      (
        await compose([
          "run",
          "--rm",
          "--no-deps",
          "bot",
          "bun",
          "run",
          "register-commands",
        ])
      ).code
    );
  }
  for (const [service, internal, external] of [
    ["api", "3000", settings.DEV_API_PORT || "3000"],
    ["activity", "5173", settings.DEV_ACTIVITY_PORT || "5173"],
  ]) {
    const running = await compose(["port", service!, internal!], true);
    if (running.code === 0 && running.output.trim()) continue;
    try {
      const listener = Bun.listen({
        hostname: "127.0.0.1",
        port: Number(external),
        socket: { data() {} },
      });
      listener.stop(true);
    } catch {
      throw new Error(
        `Port ${external} is occupied. Stop the existing ${service} server or change its host port in dev/.env.`,
      );
    }
  }
  const sandbox = await compose(["build", "sandbox"]);
  if (sandbox.code) return sandbox.code;
  console.log(
    `Activity: ${settings.DEV_PUBLIC_ORIGIN}. Tunnel destination: http://activity:5173. Stop the old manual connector before using this stack.`,
  );
  return (
    await compose([
      "up",
      "--build",
      "--abort-on-container-failure",
      "api",
      "bot",
      "activity",
      "cloudflared",
    ])
  ).code;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Development command failed",
  );
  process.exitCode = 1;
}
