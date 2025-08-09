#!/usr/bin/env node

import pkg from "@atproto/api";
const { BskyAgent } = pkg;
import chalk from "chalk";
import fs from "fs";
import path from "path";
import readline from "readline";
import { parseArgs, buildHelp } from "./utils/args.js";
import { checkIfLikelyBot } from "./utils/botCheck.js";

// ---------------- Flags / schema ----------------
const schema = {
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
    desc: "Block suspected bots automatically",
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
    default: 1,
    desc: "Number of follower pages (x100) to scan",
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
      "SkySweep CLI – Bluesky bot scanner",
      [
        "node index.js --simulate --verbose",
        "node index.js --auto-block --delay 500 --profile-delay 150 --max-blocks 25",
        "node index.js --simulate --pages 3 --export csv --out suspected-bots.csv",
        "node index.js --target someone.bsky.social --simulate",
      ],
      schema
    )
  );
  process.exit(0);
}

// ---------------- Helpers ----------------
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

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
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}
function toCSV(rows) {
  const headers = [
    "handle",
    "did",
    "followers",
    "following",
    "posts",
    "ratio",
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
  const ans = (
    await ask(`${q}\n   ${hint}\n   Choose [${defIndex + 1}]: `)
  ).trim();
  const idx =
    Math.max(1, Math.min(choices.length, Number(ans) || defIndex + 1)) - 1;
  return choices[idx];
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

(async function main() {
  console.log("🌌 SkySweep CLI – Follower Bot Scanner for Bluesky");

  // ---------- Interactive mode (if no mode flags provided) ----------
  let simulateMode = flags["simulate"];
  let autoBlockMode = flags["auto-block"];
  let verbose = flags["verbose"];
  let blockDelayMs = flags["delay"];
  let profileDelayMs = flags["profile-delay"];
  let maxBlocks = flags["max-blocks"];
  let pages = Math.max(1, Number(flags["pages"] || 1));
  let targetOverride = (flags["target"] || "").trim();
  let exportFmt = (flags["export"] || "").toLowerCase(); // "", "json", "csv"
  let outputFile = flags["out"];

  const noModeGiven = !simulateMode && !autoBlockMode && !exportFmt;
  if (noModeGiven) {
    console.log(chalk.cyan("\nNo flags provided — entering friendly setup…"));
    const mode = await askChoice("Choose run mode:", [
      "Review only (no changes)",
      "Simulate blocks",
      "Auto-block",
    ]);
    if (mode.startsWith("Simulate")) simulateMode = true;
    if (mode.startsWith("Auto-block")) autoBlockMode = true;

    const wantsExport = await askYesNo(
      "Export suspected bots to a file?",
      false
    );
    if (wantsExport) {
      const fmt = await askChoice("Export format:", ["json", "csv"], 1);
      exportFmt = fmt;
      const suggested = `skysweep-suspects-${nowStamp()}.${fmt}`;
      const name = (await ask(`Filename (enter to use ${suggested}): `)).trim();
      outputFile = name || suggested;
    }

    verbose = await askYesNo(
      "Verbose output (show reasons and ratios)?",
      false
    );

    const wantsTarget = await askYesNo(
      "Scan a different account’s followers (not yourself)?",
      false
    );
    if (wantsTarget) {
      targetOverride = (
        await ask("Target handle (e.g. someone.bsky.social): ")
      ).trim();
    }

    pages = await askNumber(
      "How many pages of followers to scan? (1 page = 100 followers)",
      1
    );

    if (autoBlockMode) {
      maxBlocks = await askNumber(
        "Max number of accounts to block this run",
        maxBlocks
      );
      blockDelayMs = await askNumber(
        "Delay between block calls (ms)",
        blockDelayMs
      );
    }
    profileDelayMs = await askNumber(
      "Delay between profile lookups (ms)",
      profileDelayMs
    );

    // summary + confirm
    console.log(
      chalk.cyan(`
Summary:
  Mode:            ${
    simulateMode ? "simulate" : autoBlockMode ? "auto-block" : "review-only"
  }
  Target:          ${targetOverride || "(self)"}
  Pages:           ${pages}
  Profile delay:   ${profileDelayMs} ms
  Block delay:     ${blockDelayMs} ms
  Max blocks:      ${isFinite(maxBlocks) ? maxBlocks : "∞"}
  Export:          ${exportFmt || "none"} ${
        outputFile ? `(file: ${outputFile})` : ""
      }
  Verbose:         ${verbose ? "yes" : "no"}
`)
    );
    const ok = await askYesNo("Proceed?", true);
    if (!ok) {
      console.log("Cancelled. Bye!");
      rl.close();
      process.exit(0);
    }
  } else {
    console.log(
      chalk.cyan(`
Flags this run:
  Mode:            ${
    simulateMode ? "simulate" : autoBlockMode ? "auto-block" : "review-only"
  }
  Target:          ${targetOverride || "(self)"}
  Pages:           ${pages}
  Profile delay:   ${profileDelayMs} ms
  Block delay:     ${blockDelayMs} ms
  Max blocks:      ${isFinite(maxBlocks) ? maxBlocks : "∞"}
  Export:          ${exportFmt || "none"} ${
        outputFile ? `(file: ${outputFile})` : ""
      }
  Verbose:         ${verbose ? "yes" : "no"}
`)
    );
  }

  // ---------- Auth ----------
  const identifier = (
    await ask("🧑‍💻 Your handle (e.g. you.bsky.social): ")
  ).trim();
  console.log(
    "\n🔐 Please use a *Bluesky App Password* — not your main account password."
  );
  console.log(
    "👉 Generate one: https://bsky.app/settings (scroll to 'App Passwords')\n"
  );
  const password = await askHidden("🔐 Your app password: ");

  const agent = new BskyAgent({ service: "https://bsky.social" });
  try {
    await agent.login({ identifier, password });
    console.log(chalk.green("✅ Logged in successfully!"));
  } catch (err) {
    console.error(
      chalk.red("❌ Login failed. Check your handle or app password.")
    );
    rl.close();
    process.exit(1);
  }

  const actor = targetOverride || identifier;

  // ---------- Fetch followers with pagination ----------
  let followers = [];
  let cursor;
  for (let i = 0; i < pages; i++) {
    try {
      const res = await agent.getFollowers({ actor, limit: 100, cursor });
      followers.push(...(res?.data?.followers ?? []));
      cursor = res?.data?.cursor;
      if (!cursor) break;
    } catch (e) {
      console.error(
        chalk.red(
          "❌ Couldn’t fetch followers. Check handle or try again later."
        )
      );
      rl.close();
      process.exit(1);
    }
  }
  console.log(`📥 Fetched ${followers.length} follower(s) from ${actor}.`);
  console.log(`📊 Checking profiles...\n`);

  // ---------- Scan ----------
  let scanned = 0;
  let suspectCount = 0;
  let blockCount = 0;
  const exportRows = [];

  for (const user of followers) {
    try {
      // fetch full profile for accurate counts
      const profileRes = await agent.getProfile({ actor: user.did });
      const fullUser = profileRes.data;

      if (profileDelayMs > 0) await sleep(profileDelayMs);

      const reason = checkIfLikelyBot(fullUser);
      const ratio = (
        (fullUser.followersCount || 0) / Math.max(1, fullUser.followsCount || 1)
      ).toFixed(3);

      if (verbose) {
        console.log(
          chalk.gray(
            `🔎 @${fullUser.handle} • Follows ${
              fullUser.followsCount
            } | Followers ${fullUser.followersCount} | Posts ${
              fullUser.postsCount
            } | Ratio ${ratio} | Match ${Boolean(reason)}`
          )
        );
      }

      if (reason) {
        suspectCount++;
        exportRows.push({
          handle: fullUser.handle,
          did: fullUser.did,
          followers: fullUser.followersCount ?? 0,
          following: fullUser.followsCount ?? 0,
          posts: fullUser.postsCount ?? 0,
          ratio,
          reason,
        });

        if (simulateMode) {
          console.log(
            chalk.yellow(
              `👻 Would block: @${fullUser.handle} (reason: ${reason})`
            )
          );
        } else if (autoBlockMode) {
          if (blockCount < maxBlocks) {
            // **FIX**: use interactive-adjusted value, not raw flags
            const ok = await safeBlock(
              agent,
              fullUser,
              reason,
              1,
              blockDelayMs,
              verbose
            );
            if (ok) blockCount++;
          } else if (blockCount === maxBlocks) {
            console.log(
              chalk.gray(
                `🚦 Max blocks reached (${maxBlocks}). Skipping remaining.`
              )
            );
          }
        } else {
          console.log(
            chalk.magenta(
              `⚠️  [SUSPECTED BOT] @${fullUser.handle} (reason: ${reason})`
            )
          );
        }
      }

      scanned++;
    } catch (err) {
      console.warn(
        chalk.gray(
          `⚠️ Could not fetch profile for @${user.handle}: ${String(
            err?.message || err
          )}`
        )
      );
    }
  }

  // ---------- Export ----------
  if ((exportFmt === "json" || exportFmt === "csv") && exportRows.length) {
    const base = outputFile || `skysweep-suspects-${nowStamp()}.${exportFmt}`;
    const name = safeFilename(base);
    try {
      const data =
        exportFmt === "json"
          ? JSON.stringify(exportRows, null, 2)
          : toCSV(exportRows);
      fs.writeFileSync(path.resolve(name), data, "utf8");
      console.log(
        chalk.cyan(
          `\n💾 Exported ${exportRows.length} suspected bot(s) to ${name}`
        )
      );
    } catch (e) {
      console.error(
        chalk.red(`❌ Failed to write export file: ${String(e?.message || e)}`)
      );
    }
  } else if (exportFmt && !["json", "csv"].includes(exportFmt)) {
    console.log(
      chalk.red(
        `❌ Unsupported --export format: ${exportFmt}. Use "json" or "csv".`
      )
    );
  }

  // ---------- Summary ----------
  console.log(
    `\n🔎 Scan summary: scanned ${scanned}, flagged ${suspectCount}, ${
      autoBlockMode
        ? `blocked ${blockCount}`
        : simulateMode
        ? "blocked 0 (simulation)"
        : "no blocks (review mode)"
    }. `
  );
  if (simulateMode)
    console.log(chalk.gray("🧪 Simulation mode: No actions were taken.\n"));
  else if (!autoBlockMode)
    console.log(
      chalk.gray(
        "💡 Tip: run with --simulate to preview blocks, or --auto-block to apply them."
      )
    );

  rl.close();
})();
