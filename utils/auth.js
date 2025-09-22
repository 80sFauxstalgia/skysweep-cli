import pkg from "@atproto/api";
const { BskyAgent } = pkg;
import chalk from "chalk";
import { ask, askHidden } from "./readline.js";

export async function getCredentials(config) {
  let identifier = config.identifier || (await ask("🧑‍💻 Your handle (e.g., 'yourname' or 'user.custom.com'): ")).trim();

  // If the user just enters a handle without a domain, append .bsky.social
  if (identifier && !identifier.includes('.')) {
    identifier += '.bsky.social';
    console.log(chalk.gray(`(Assuming full handle: ${identifier})`));
  }

  if (!config.password) {
    console.log(
      "\n🔐 Please use a *Bluesky App Password* — not your main account password."
    );
    console.log(
      "👉 Generate one: https://bsky.app/settings (scroll to 'App Passwords')\n"
    );
  }
  const password = config.password || (await askHidden("🔐 Your app password: "));

  return { identifier, password };
}

export async function authenticate(identifier, password) {
  const bskyAgent = new BskyAgent({ service: "https://bsky.social" });
  try {
    await bskyAgent.login({ identifier, password });
    console.log(chalk.green("✅ Logged in successfully!"));
    return bskyAgent;
  } catch (err) {
    console.error(
      chalk.red("❌ Login failed. Check your handle or app password.")
    );
    return null;
  }
}

export async function login(config) {
  let agent = null;
  let attempts = 0;
  const MAX_LOGIN_ATTEMPTS = 3;

  while (!agent && attempts < MAX_LOGIN_ATTEMPTS) {
    attempts++;
    const { identifier, password } = await getCredentials(config);

    if (!identifier || !password) {
      console.log(chalk.yellow("⚠️ Handle and password cannot be empty. Please try again."));
      continue; // Skip login attempt if credentials are empty
    }

    agent = await authenticate(identifier, password);
    if (agent) {
      config.identifier = identifier; // Store for saving
    } else if (attempts < MAX_LOGIN_ATTEMPTS) {
      console.log(chalk.gray(`(Attempt ${attempts}/${MAX_LOGIN_ATTEMPTS}. Please try again.)`));
    }
  }

  if (!agent && attempts >= MAX_LOGIN_ATTEMPTS) {
    console.error(chalk.red("❌ Maximum login attempts reached. Exiting."));
  }

  return agent;
}