#!/usr/bin/env node
// Sets (or changes) the site's sign-in: asks for a user and a password, hashes the password with
// scrypt and stores { user, passwordHash, sessionKey } as a SecureString in SSM, where the API reads
// it. The password never leaves this machine in clear, and it is never in the repo or the bundle.
// Running it again changes the password and ends every session (a new sessionKey).
//
//   aws sso login --sso-session jonomait
//   npm run set-login -- --prefix jonomait --environment production --profile jonomait-production
//
// --prefix is the PROJECT_PREFIX org variable; the region, PRIMARY_REGION (default us-east-1).
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { hashPassword } from "../api/auth.mjs";

const { values: args } = parseArgs({
  options: {
    prefix: { type: "string" },
    environment: { type: "string", default: "production" },
    profile: { type: "string" },
    region: { type: "string", default: process.env.PRIMARY_REGION || "us-east-1" },
    app: { type: "string", default: "web-english" },
  },
});
if (!args.prefix) {
  console.error("--prefix is required (the PROJECT_PREFIX org variable, e.g. jonomait).");
  process.exit(1);
}

/** Reads a line; with hidden = true the typed characters are not echoed. */
function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : "");
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const user = (await ask("User: ")).trim().toLowerCase();
const password = await ask("Password (12+ characters): ", true);
if (!user || password.length < 12) {
  console.error("A user and a password of at least 12 characters, please.");
  process.exit(1);
}
if ((await ask("Repeat the password: ", true)) !== password) {
  console.error("The passwords do not match.");
  process.exit(1);
}

const value = JSON.stringify({
  user,
  passwordHash: await hashPassword(password),
  sessionKey: randomBytes(32).toString("base64url"),
});
const name = `/${args.prefix}/${args.environment}/${args.app}/secrets/login`;

// Through a private temporary file, not the command line: other processes can read arguments.
const dir = mkdtempSync(join(tmpdir(), "set-login-"));
const file = join(dir, "value.json");
try {
  writeFileSync(file, value, { mode: 0o600 });
  execFileSync(
    "aws",
    [
      "ssm",
      "put-parameter",
      "--name",
      name,
      "--type",
      "SecureString",
      "--overwrite",
      "--value",
      `file://${file}`,
      "--region",
      args.region,
      ...(args.profile ? ["--profile", args.profile] : []),
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`Sign-in saved in ${name} (${args.region}). Sessions signed with the previous key are over.`);
