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

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("🌌 SkySweep CLI – Follower Bot Scanner for Bluesky");

  const identifier = await ask("🧑‍💻 Your handle (e.g. you.bsky.social): ");
  const password = await ask("🔐 Your app password: ");

  const agent = new BskyAgent({ service: "https://bsky.social" });

  try {
    await agent.login({ identifier, password });
    console.log("✅ Logged in successfully!");
  } catch (err) {
    console.error("❌ Login failed. Check your handle or app password.");
    process.exit(1);
  }

  console.log("📥 Fetching followers...");
  const res = await agent.getFollowers({ actor: identifier, limit: 100 });

  const followers = res.data.followers;
  console.log(`📊 Checking ${followers.length} accounts...`);

  let suspectCount = 0;
  for (const user of followers) {
    if (checkIfLikelyBot(user)) {
      suspectCount++;
      console.log(
        `⚠️  [SUSPECTED BOT] @${user.handle} | Follows: ${user.followsCount} | Followers: ${user.followersCount}`
      );
    }
  }

  console.log(`\n🔎 Found ${suspectCount} suspected bots.`);
  rl.close();
}

main();
