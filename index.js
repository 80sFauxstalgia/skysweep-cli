#!/usr/bin/env node

import pkg from "@atproto/api";
const { BskyAgent } = pkg;
import chalk from "chalk";
import readline from "readline";
import { checkIfLikelyBot } from "./utils/botCheck.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Read CLI flags
const simulateMode = process.argv.includes("--simulate");
const autoBlockMode = process.argv.includes("--auto-block");

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("🌌 SkySweep CLI – Follower Bot Scanner for Bluesky");

  const identifier = await ask("🧑‍💻 Your handle (e.g. you.bsky.social): ");
  console.log(
    "\n🔐 Please use a *Bluesky App Password* — not your main account password."
  );
  console.log(
    "👉 You can generate one here: https://bsky.app/settings (scroll down to 'App Passwords')\n"
  );

  const password = await ask("🔐 Your app password: ");

  const agent = new BskyAgent({ service: "https://bsky.social" });

  try {
    await agent.login({ identifier, password });
    console.log(chalk.green("✅ Logged in successfully!"));
  } catch (err) {
    console.error(
      chalk.red("❌ Login failed. Check your handle or app password.")
    );
    process.exit(1);
  }

  console.log("📥 Fetching followers...");
  const res = await agent.getFollowers({ actor: identifier, limit: 100 });

  const followers = res.data.followers;
  console.log(`📊 Checking ${followers.length} accounts...\n`);

  let suspectCount = 0;

  for (const user of followers) {
    try {
      const profileRes = await agent.getProfile({ actor: user.did });
      const fullUser = profileRes.data;

      const reason = checkIfLikelyBot(fullUser);

      if (reason) {
        suspectCount++;

        if (simulateMode) {
          console.log(
            chalk.yellow(
              `👻 Would block: @${fullUser.handle} (reason: ${reason})`
            )
          );
        } else if (autoBlockMode) {
          await agent.api.app.bsky.graph.block.createBlock({
            repo: agent.session.did,
            record: {
              subject: fullUser.did,
              createdAt: new Date().toISOString(),
            },
          });

          console.log(
            chalk.red(`✅ Blocked: @${fullUser.handle} (reason: ${reason})`)
          );
        } else {
          console.log(
            chalk.magenta(
              `⚠️  [SUSPECTED BOT] @${fullUser.handle} (reason: ${reason})`
            )
          );
        }
      }
    } catch (err) {
      console.warn(
        chalk.gray(
          `⚠️ Could not fetch profile for @${user.handle}: ${err.message}`
        )
      );
    }
  }

  console.log(
    `\n🔎 Found ${suspectCount} suspected bot${suspectCount === 1 ? "" : "s"}.`
  );

  if (simulateMode) {
    console.log(chalk.gray("🧪 Simulation mode: No actions were taken.\n"));
  }

  rl.close();
}

main();
