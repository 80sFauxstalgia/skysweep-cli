#!/usr/bin/env node

import pkg from "@atproto/api";
const { BskyAgent } = pkg;
import chalk from "chalk";
import fs from "fs";
import path from "path";
import readline from "readline";
import { parseArgs, buildHelp } from "./utils/args.js";
import { checkIfLikelyBot } from "./utils/botCheck.js";
import { checkIfLikelyMarketer } from "./utils/marketerCheck.js";

// ---------------- Flags / schema ----------------
const schema = {
  config: {
    type: "string",
    alias: "c",
    default: "config.json",
    desc: "Path to a JSON config file",
  },
  simulate: {
    type: "bool",
    alias: "s",
    default: false,
    desc: "Preview blocks; take no action",
  },
  "auto-block": {
    type: "bool",
    alias: "b",
    default: false,
    desc: "Block suspected accounts automatically",
  },
  delay: {
    type: "number",
    alias: "d",
    default: 400,
    desc: "Delay between block calls (ms)",
  },
  "profile-delay": {
    type: "number",
    alias: "p",
    default: 100,
    desc: "Delay between profile fetches (ms)",
  },
  "max-blocks": {
    type: "number",
    alias: "m",
    default: 25,
    desc: "Cap number of blocks this run",
  },
  pages: {
    type: "number",
    alias: "g",
    default: 0,
    desc: "Pages to scan (100 per page). 0 = ALL followers",
  },
  target: {
    type: "string",
    alias: "t",
    default: "",
    desc: "Scan followers of this handle instead of yourself",
  },
  export: {
    type: "string",
    alias: "e",
    default: "",
    desc: "Export format: json | csv",
  },
  out: {
    type: "string",
    alias: "o",
    default: "",
    desc: "Output filename (optional)",
  },
  verbose: {
    type: "bool",
    alias: "v",
    default: false,
    desc: "Print detailed reasoning/metrics",
  },
  "include-marketers": {
    type: "bool",
    alias: "k",
    default: false,
    desc: "Also flag marketer-style accounts",
  },
  "marketer-only": {
    type: "bool",
    alias: "K",
    default: false,
    desc: "Only act on marketer-style accounts",
  },
  "download-media": {
    type: "string",
    alias: "x",
    default: "",
    desc: "Download all media to this path",
  },
  nuke: {
    type: "string",
    alias: "n",
    default: "",
    desc: "DANGER: all-posts | media-posts | text-posts | likes",
  },
  configure: {
    type: "bool",
    default: false,
    desc: "Run the interactive configuration setup",
  },
  help: {
    type: "bool",
    alias: "h",
    default: false,
    desc: "Show help and exit",
  },
};

const flags = parseArgs(process.argv.slice(2), schema);

// ---------------- Basic help ----------------
if (flags.help) {
  console.log(
    buildHelp(
      "SkySweep CLI – Bluesky Account Toolkit",
      [
        "node skysweep.js",
        "node skysweep.js --download-media ./my-media",
        "node skysweep.js --configure",
        "node skysweep.js --auto-block --pages 10",
      ],
      schema
    )
  );
  process.exit(0);
}

// ---------------- Helpers ----------------
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function readConfig(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn(
      chalk.yellow(`⚠️ Could not read or parse config file: ${filePath}`)
    );
  }
  return {};
}

function nowStamp() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(
    d.getHours()
  )}${z(d.getMinutes())}${z(d.getSeconds())}`;
}
function safeFilename(name) {
  return String(name)
    .replace(/[^\w.\-]/g, "_")
    .slice(0, 120);
}

function csvEscape(s) {
  const str = String(s ?? "");
  return /[\",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCSV(rows) {
  const headers = [
    "handle",
    "did",
    "followers",
    "following",
    "posts",
    "ratio",
    "category",
    "reason",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.handle),
        csvEscape(r.did),
        r.followers,
        r.following,
        r.posts,
        r.ratio,
        csvEscape(r.category ?? ""),
        csvEscape(r.reason),
      ].join(",")
    );
  }
  return lines.join("\n");
}

// readline + prompts (with hidden input)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
async function askHidden(prompt) {
  return new Promise((resolve) => {
    const _write = rl._writeToOutput;
    rl._writeToOutput = (str) => {
      if (str.includes("\n")) _write.call(rl, str);
      else _write.call(rl, "*");
    };
    rl.question(prompt, (answer) => {
      rl._writeToOutput = _write;
      rl.output.write("\n");
      resolve(answer);
    });
  });
}
async function askYesNo(q, def = true) {
  const hint = def ? "[Y/n]" : "[y/N]";
  const ans = (await ask(`${q} ${hint} `)).trim().toLowerCase();
  if (!ans) return def;
  return ["y", "yes"].includes(ans);
}
async function askNumber(q, def) {
  const ans = (await ask(`${q} (default ${def}): `)).trim();
  const n = Number(ans);
  return Number.isFinite(n) ? n : def;
}
async function askChoice(q, choices, defIndex = 0) {
  const hint = choices.map((c, i) => `${i + 1}) ${c}`).join("  ");
  while (true) {
    const ans = (
      await ask(`${q}\n   ${hint}\n   Choose [${defIndex + 1}]: `)
    ).trim();
    if (!ans) return choices[defIndex]; // User pressed enter for default
    const idx = Number(ans) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < choices.length) {
      return choices[idx];
    }
    console.log(chalk.yellow("⚠️ Invalid choice. Please enter a number from the list."));
  }
}

// graceful Ctrl+C
process.on("SIGINT", () => {
  console.log("\n👋 Cancelled.");
  try {
    rl.close();
  } catch {}
  process.exit(0);
});

// ---------------- Auth ----------------
async function login(config) {
  let identifier = 
    config.identifier ||
    (await ask("🧑‍💻 Your handle (e.g., 'yourname' or 'user.custom.com'): ")).trim();

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
  const password = 
    config.password || (await askHidden("🔐 Your app password: "));

  const agent = new BskyAgent({ service: "https://bsky.social" });
  try {
    await agent.login({ identifier, password });
    console.log(chalk.green("✅ Logged in successfully!"));
    config.identifier = identifier; // Store for saving
    return agent;
  } catch (err) {
    console.error(
      chalk.red("❌ Login failed. Check your handle or app password.")
    );
    return null;
  }
}

// ---------------- Safe block wrapper ----------------
async function safeBlock(
  agent,
  fullUser,
  reason,
  attempt = 1,
  blockDelay = 400,
  verbose = false
) {
  try {
    await agent.com.atproto.repo.createRecord({
      repo: agent.session.did,
      collection: "app.bsky.graph.block",
      record: {
        $type: "app.bsky.graph.block",
        subject: fullUser.did,
        createdAt: new Date().toISOString(),
      },
    });
    console.log(
      chalk.red(`✅ Blocked: @${fullUser.handle} (reason: ${reason})`)
    );
    await sleep(blockDelay);
    return true;
  } catch (err) {
    const msg = String(err?.message || err);
    if (verbose)
      console.warn(chalk.gray(`⛔ Block failed @${fullUser.handle}: ${msg}`));
    if (attempt < 3 && /429|rate|timeout|temporar/i.test(msg)) {
      const backoff = 1000 * attempt;
      if (verbose)
        console.log(
          chalk.gray(`⏳ Backing off ${backoff}ms (attempt ${attempt + 1}/3)…`)
        );
      await sleep(backoff);
      return safeBlock(
        agent,
        fullUser,
        reason,
        attempt + 1,
        blockDelay,
        verbose
      );
    }
    return false;
  }
}

const BOT_SCORE_THRESHOLD = 35;\nconst MARKETER_SCORE_THRESHOLD = 30;\n\n// ---------------- Download all media ----------------
async function downloadAllMedia(agent, actor, downloadPath) {
  console.log(chalk.cyan(`\n💾 Starting media download for @${actor}...`));
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
    console.log(chalk.gray(`📂 Created directory: ${downloadPath}`));
  }

  let allPosts = [];
  let cursor;
  let pageCount = 0;
  let mediaCount = 0;

  while (true) {
    try {
      const res = await agent.getAuthorFeed({ actor, limit: 100, cursor });
      if (res.data.feed.length === 0) break;

      allPosts.push(...res.data.feed);
      cursor = res.data.cursor;
      pageCount++;
      console.log(chalk.gray(`📄 Fetched page ${pageCount} of posts...`));

      if (!cursor) break;
    } catch (err) {
      console.error(chalk.red(`❌ Could not fetch posts: ${err.message}`));
      return;
    }
  }

  console.log(chalk.cyan(`\nFound ${allPosts.length} posts. Checking for media...`));

  for (const post of allPosts) {
    const images = post.post.embed?.images;
    if (images && Array.isArray(images)) {
      const postRkey = post.post.uri.split("/").pop();
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const imageUrl = image.fullsize;
        const mimeType = image.mimeType;
        const extension = mimeType.split("/")[1] || "jpg";
        const filename = `${postRkey}_${i}.${extension}`;
        const filepath = path.join(downloadPath, filename);

        try {
          console.log(chalk.gray(`  Downloading ${filename}...`));
          const imageRes = await fetch(imageUrl);
          if (!imageRes.ok) {
            console.warn(chalk.yellow(`  ⚠️ Failed to download ${filename}: ${imageRes.statusText}`));
            continue;
          }
          const buffer = Buffer.from(await imageRes.arrayBuffer());
          fs.writeFileSync(filepath, buffer);
          mediaCount++;
        } catch (err) {
          console.warn(chalk.yellow(`  ⚠️ Error saving ${filename}: ${err.message}`));
        }
      }
    }
  }

  console.log(chalk.green(`\n✅ Download complete! Saved ${mediaCount} media file(s) to ${downloadPath}.`));
}

// ---------------- Follower Scan Logic ----------------
async function runFollowerScan(agent, actor, settings) {
  // Merge settings with defaults
  const simulateMode = settings.simulate ?? true;
  const autoBlockMode = settings.autoBlock ?? false;
  const verbose = settings.verbose ?? false;
  const blockDelayMs = settings.delay ?? 400;
  const profileDelayMs = settings.profileDelay ?? 100;
  const maxBlocks = settings.maxBlocks ?? 25;
  const pages = settings.pages ?? 5; // Default to 5 pages (~500 followers)
  const exportFmt = settings.export ?? "";
  let outputFile = settings.out ?? "";
  const includeMarketers = settings.includeMarketers ?? false;
  const marketerOnly = settings.marketerOnly ?? false;

  // ---------- Fetch followers ----------
  let followers = [];
  let cursor;
  let pageCount = 0;
  const limitByPages = pages >= 1;

  console.log(chalk.cyan(`\n🕵️  Scanning followers of @${actor}...`));

  while (true) {
    if (limitByPages && pageCount >= pages) break;
    try {
      const res = await agent.getFollowers({ actor, limit: 100, cursor });
      followers.push(...(res?.data?.followers ?? []));
      cursor = res?.data?.cursor || null;
      pageCount++;
      if (!cursor) break;
    } catch {
      console.error(chalk.red("❌ Couldn’t fetch followers. Check handle or try again later."));
      return;
    }
  }

  console.log(`📥 Fetched ${followers.length} follower(s).`);
  console.log(
    chalk.gray(
      `(Note: This may differ from your profile\'s count due to deactivated accounts.)`
    )
  );
  console.log(`📊 Checking profiles...\n`);

  // ---------- Scan ----------
  let scanned = 0, suspectCount = 0, blockCount = 0;
  const exportRows = [];

  for (const user of followers) {
    try {
      const profileRes = await agent.getProfile({ actor: user.did });
      const fullUser = profileRes.data;
      if (profileDelayMs > 0) await sleep(profileDelayMs);

      const botResult = checkIfLikelyBot(fullUser);
      const marketerResult =
        includeMarketers || marketerOnly
          ? checkIfLikelyMarketer(fullUser)
          : { score: 0, reasons: [] };

      let reason = null, category = null;
      // In marketer-only mode, we only consider marketers.
      if (marketerOnly) {
        if (marketerResult.score >= MARKETER_SCORE_THRESHOLD) {
          reason = marketerResult.reasons.join(", ");
          category = "marketer";
        }
      } else {
        // By default, bots are the primary target.
        if (botResult.score >= BOT_SCORE_THRESHOLD) {
          reason = botResult.reasons.join(", ");
          category = "bot";
        } else if (includeMarketers && marketerResult.score >= MARKETER_SCORE_THRESHOLD) {
          // If not a bot, but we are including marketers, check for marketers.
          reason = marketerResult.reasons.join(", ");
          category = "marketer";
        }
      }

      const ratio = ((fullUser.followersCount || 0) / Math.max(1, fullUser.followsCount || 1)).toFixed(3);

      if (verbose) {
        console.log(
          chalk.gray(`🔎 @${fullUser.handle} • F ${fullUser.followsCount} | F'ers ${fullUser.followersCount} | P ${fullUser.postsCount} | R ${ratio} | Match ${Boolean(reason)}${reason ? ` (${category})` : ""}`)
        );
      }

      if (reason) {
        suspectCount++;
        exportRows.push({
          handle: fullUser.handle ?? "",
          did: fullUser.did ?? "",
          followers: Number(fullUser.followersCount ?? 0),
          following: Number(fullUser.followsCount ?? 0),
          posts: Number(fullUser.postsCount ?? 0),
          ratio,
          reason,
          category,
        });

        if (simulateMode) {
          console.log(chalk.yellow(`👻 Would block: @${fullUser.handle} (reason: ${reason}; category: ${category})`));
        } else if (autoBlockMode) {
          if (blockCount < maxBlocks) {
            const ok = await safeBlock(agent, fullUser, reason, 1, blockDelayMs, verbose);
            if (ok) blockCount++;
          } else if (blockCount === maxBlocks) {
            console.log(chalk.gray(`🚦 Max blocks reached (${maxBlocks}). Skipping remaining.`));
          }
        } else {
          console.log(chalk.magenta(`⚠️  [SUSPECT] @${fullUser.handle} (reason: ${reason})`));
        }
      }
      scanned++;
    } catch (err) {
      console.warn(chalk.gray(`⚠️ Could not fetch profile for @${user.handle}: ${String(err?.message || err)}`));
    }
  }

  // ---------- Export ----------
  if ((exportFmt === "json" || exportFmt === "csv") && exportRows.length) {
    if (!outputFile) outputFile = `skysweep-suspects-${nowStamp()}.${exportFmt}`;
    const name = safeFilename(outputFile);
    try {
      const data = exportFmt === "json" ? JSON.stringify(exportRows, null, 2) : toCSV(exportRows);
      fs.writeFileSync(path.resolve(name), data, "utf8");
      console.log(chalk.cyan(`\n💾 Exported ${exportRows.length} suspected account(s) to ${name}`));
    } catch (e) {
      console.error(chalk.red(`❌ Failed to write export file: ${String(e?.message || e)}`));
    }
  }

  // ---------- Summary ----------
  console.log(
    `\n🔎 Scan summary: scanned ${scanned}, flagged ${suspectCount}, ${ 
      autoBlockMode
        ? `blocked ${blockCount}`
        : simulateMode
        ? "blocked 0 (simulation)"
        : "no blocks (review mode)"
    }.\n`
  );
}

// ---------------- Nuke Logic ----------------\n\nasync function fetchAllRecords(agent, repo, collection) {\n  const records = [];\n  let cursor;\n  while (true) {\n    try {\n      const res = await agent.com.atproto.repo.listRecords({\n        repo,\n        collection,\n        limit: 100,\n        cursor,\n      });\n      if (res.data.records.length === 0) break;\n      records.push(...res.data.records);\n      cursor = res.data.cursor;\n      if (!cursor) break;\n    } catch (err) {\n      console.error(chalk.red(`❌ Could not fetch records: ${err.message}`));\n      return []; // Return empty on error\n    }\n  }\n  return records;\n}\n\nasync function runNuke(agent, actor, settings) {\n  const nukeType = settings.nuke;\n  if (!nukeType) return;\n\n  const typeMap = {\n    \"all-posts\": \"ALL POSTS\",\n    \"media-posts\": \"ALL MEDIA POSTS\",\n    \"text-posts\": \"ALL TEXT-ONLY POSTS\",\n    likes: \"ALL LIKES\",\n  };\n\n  const readableType = typeMap[nukeType];\n  if (!readableType) {\n    console.error(chalk.red(`❌ Invalid nuke type: ${nukeType}`));\n    return;\n  }\n\n  console.log(chalk.red.bold("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"));\n  console.log(chalk.red.bold("                      DANGER: NUKE MODE"));\n  console.log(chalk.red.bold("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"));\n  console.log(chalk.yellow(`\nThis will permanently delete ${readableType} from your account.`));\n  console.log(chalk.yellow(\"This action is irreversible. There is no undo.\"));\n\n  const confirm = await ask(`\n👉 To confirm, type exactly \"${nukeType}\" and press Enter: `);\n\n  if (confirm !== nukeType) {\n    console.log(chalk.cyan("\n🛑 Nuke cancelled. No action taken."));\n    return;\n  }\n\n  console.log(chalk.cyan(`\n✅ Confirmation received. Preparing to nuke ${readableType}...`));\n\n  const repo = agent.session.did; // The repo to modify is our own\n  let records = [];\n  let collection = \"\";\n  let filterFn = () => true;\n\n  if (nukeType === \"likes\") {\n    collection = \"app.bsky.feed.like\";\n  } else if ([\"all-posts\", \"media-posts\", \"text-posts\"].includes(nukeType)) {\n    collection = \"app.bsky.feed.post\";\n    if (nukeType === \"media-posts\") {\n      filterFn = (r) => !!r.value.embed?.images;\n    } else if (nukeType === \"text-posts\") {\n      filterFn = (r) => !r.value.embed?.images;\n    }\n  }\n\n  console.log(chalk.cyan(`\nFetching all records...`));\n  records = await fetchAllRecords(agent, repo, collection);\n\n  const toDelete = records.filter(filterFn);\n\n  if (toDelete.length === 0) {\n    console.log(chalk.green("\n✅ No records to delete."));\n    return;\n  }\n\n  console.log(chalk.yellow(`\nFound ${toDelete.length} item(s) to delete.`));\n\n  let deletedCount = 0;\n  const delay = settings.delay ?? 200; // Use a safe delay\n\n  for (const record of toDelete) {\n    try {\n      await agent.com.atproto.repo.deleteRecord({\n        repo,\n        collection,\n        rkey: record.uri.split(\"/").pop(),\n      });\n      deletedCount++;\n      console.log(`  (${deletedCount}/${toDelete.length}) Deleted ${record.uri}`);\n      await sleep(delay);\n    } catch (err) {\n      console.error(chalk.red(`❌ Error deleting ${record.uri}: ${err.message}`));\n      // Continue to next record\n    }\n  }\n\n  console.log(chalk.green(`\n✅ Nuke complete. Deleted ${deletedCount} item(s).`));\n}\n\n// ---------------- Configuration Logic ----------------
async function runConfiguration(settings) {
  console.log(chalk.cyan("\n⚙️  Entering advanced configuration..."));

  const newSettings = { ...settings };

  const mode = await askChoice("Choose run mode:", ["Review only", "Simulate blocks", "Auto-block"]);
  newSettings.simulate = mode.startsWith("Simulate");
  newSettings.autoBlock = mode.startsWith("Auto-block");

  const scope = await askChoice("\nHow much of your follower history would you like to scan?", [
    "Recent (~500 followers)",
    "Extended (~2500 followers)",
    "All followers (can be slow for large accounts)",
  ], 0);

  if (scope.startsWith("Recent")) {
    newSettings.pages = 5;
  } else if (scope.startsWith("Extended")) {
    newSettings.pages = 25;
  } else { // "All"
    newSettings.pages = 0;
  }

  newSettings.includeMarketers = await askYesNo("\nAlso flag marketer-style accounts?", false);
  if (!newSettings.includeMarketers) {
    newSettings.marketerOnly = await askYesNo("Marketer-only mode (ignore classic bots)?", false);
  }

  const wantsExport = await askYesNo("\nExport suspected accounts to a file?", false);
  if (wantsExport) {
    newSettings.export = await askChoice("Export format:", ["json", "csv"], 1);
    const suggested = `skysweep-suspects-${nowStamp()}.${newSettings.export}`;
    const name = (await ask(`Filename (enter to use ${suggested}): `)).trim();
    newSettings.out = name || suggested;
  }

  newSettings.verbose = await askYesNo("\nVerbose output (show reasons and ratios)?", false);

  const wantsTarget = await askYesNo("\nScan a different account’s followers (not yourself)?", false);
  if (wantsTarget) {
    newSettings.target = (await ask("Target handle (e.g. 'user.custom.com'): ")).trim();
  }

  if (newSettings.autoBlock) {
    newSettings.maxBlocks = await askNumber("\nMax accounts to block this run", settings.maxBlocks ?? 25);
  }

  // Delay questions are removed to simplify UX.
  // The tool will use smart defaults and adaptive rate limiting.

  return newSettings;
}


// ---------------- Main Application Logic ----------------
(async function main() {
  console.log("🌌 Welcome to SkySweep!");

  const configPath = flags.config || "config.json";
  let config = readConfig(configPath);
  
  // Combine flags into config to unify settings
  config = { ...config, ...flags };

  // --- Direct Action Dispatcher ---
  // If a specific action flag is used, run it directly without the menu.
  const hasDirectAction = flags["download-media"] || flags.nuke || flags["auto-block"] || flags.simulate;

  if (hasDirectAction && !flags.configure) {
    const agent = await login(config);
    if (!agent) return;
    const actor = config.target || agent.session.did;

    if (config["download-media"]) {
      await downloadAllMedia(agent, actor, config["download-media"]);
    } else if (config.nuke) {
      await runNuke(agent, actor, config);
    } else {
      // Default action for flags like --auto-block is to run the scan
      await runFollowerScan(agent, actor, config);
    }
    return;
  }
  
  if (flags.configure) {
      const newConfig = await runConfiguration(config);
      const save = await askYesNo("\n💾 Save these settings to config.json for next time?", true);
      if (save) {
        const { identifier, password, ...savableConfig } = newConfig;
        savableConfig.identifier = config.identifier; // Keep the handle
        fs.writeFileSync("config.json", JSON.stringify(savableConfig, null, 2), "utf8");
        console.log(chalk.cyan("✅ Settings saved to config.json."));
      }
      return;
  }

  // --- Interactive Menu ---
  const choice = await askChoice("\nWhat would you like to do?", [
    "🕵️  Scan followers for bots (Safe simulation)",
    "💾  Back up all my media",
    "⚙️  Configure advanced settings",
    "🚪  Exit",
  ]);

  if (choice.endsWith("Exit")) {
    console.log(chalk.cyan("\n👋 Bye!"));
    return;
  }

  // Login is required for all menu actions from this point
  const agent = await login(config);
  if (!agent) return;
  const actor = config.target || agent.session.did;

  if (choice.startsWith("🕵️")) {
    // Run scan with safe, default settings
    await runFollowerScan(agent, actor, { ...config, simulate: true, pages: 0 });
  } else if (choice.startsWith("💾")) {
    const downloadPath = await ask("Enter the path to save your media: ");
    if (downloadPath) {
      await downloadAllMedia(agent, actor, downloadPath);
    }
  } else if (choice.startsWith("⚙️")) {
    const newConfig = await runConfiguration(config);
    const save = await askYesNo("\n💾 Save these settings to config.json for next time?", true);
    if (save) {
      const { identifier, password, ...savableConfig } = newConfig;
      savableConfig.identifier = config.identifier; // Keep the handle
      fs.writeFileSync("config.json", JSON.stringify(savableConfig, null, 2), "utf8");
      console.log(chalk.cyan("✅ Settings saved to config.json."));
    }
  }
})().finally(() => {
  try {
    rl.close();
  } catch {}
});
