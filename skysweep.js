#!/usr/bin/env node

import chalk from "chalk";
import fs from "fs";
import os from "os";
import path from "path";
import { ask, rl } from "./utils/readline.js";
import { parseArgs, buildHelp } from "./utils/args.js";
import { checkIfLikelyBot } from "./utils/botCheck.js";
import { checkIfLikelyMarketer } from "./utils/marketerCheck.js";
import { login } from "./utils/auth.js";

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
  "filter-tags": {
    type: "string",
    default: "",
    desc: "Only act on posts with these comma-separated tags",
  },
  "untagged-only": {
    type: "bool",
    default: false,
    desc: "Only act on posts with no content tags",
  },
  "media-type": {
    type: "string",
    default: "all",
    desc: "Type of media to download: all | photos | videos",
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

const BOT_SCORE_THRESHOLD = 35;
const MARKETER_SCORE_THRESHOLD = 30;

// ---------------- Download all media ----------------
  async function downloadAllMedia(agent, actor, settings) {
  const { "download-media": downloadPath, filterTags, untaggedOnly, "media-type": mediaType } = settings;
  console.log(chalk.cyan(`\n💾 Starting media download for @${actor}...`));
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
    console.log(chalk.gray(`📂 Created directory: ${downloadPath}`));
  }

  let allPosts = [];
  let cursor;
  let pageCount = 0;

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

  console.log(chalk.cyan(`\nFound ${allPosts.length} total posts.`));

  // Filter out reposts
  allPosts = allPosts.filter(p => !p.reason);

  // Filter posts based on tags
  const activeFilter = filterTags || untaggedOnly;
  const filteredPosts = activeFilter ? allPosts.filter(feedViewPost => {
    const postView = feedViewPost.post;
    const allLabels = new Set();

    const moderationLabels = postView.labels || [];
    if (Array.isArray(moderationLabels)) {
      for (const label of moderationLabels) allLabels.add(label.val);
    }

    const selfLabelValues = postView.record?.labels?.values || [];
    if (Array.isArray(selfLabelValues)) {
      for (const label of selfLabelValues) allLabels.add(label.val);
    }

    if (untaggedOnly) {
      return allLabels.size === 0;
    }
    if (filterTags) {
      const filterTagSet = new Set(filterTags.split(",").map(t => t.trim()));
      for (const label of allLabels) {
        if (filterTagSet.has(label)) return true;
      }
      return false;
    }
    return true;
  }) : allPosts;

  if (activeFilter) {
    console.log(chalk.cyan(`Filtered down to ${filteredPosts.length} posts based on your criteria.`));
  }
  
  // --- Build Download Queue ---
  const downloadQueue = [];
  for (const post of filteredPosts) {
    const p = post.post; // postView
    if (!p.embed) continue; // Skip posts without embeds

    const postRkey = p.uri.split("/").pop();

    // Handle photos
    if (mediaType === 'all' || mediaType === 'photos') {
        const mediaInEmbed = p.embed?.images || (p.embed?.media?.images) || [];
        for (let i = 0; i < mediaInEmbed.length; i++) {
            const image = mediaInEmbed[i];
            const imageUrl = image.fullsize;
            const mimeType = image.mimeType;
            let extension = "jpg";
            if (mimeType && mimeType.includes("/")) {
                extension = mimeType.split("/")[1];
            }
            const filename = `${postRkey}_${i}.${extension}`;
            const filepath = path.join(downloadPath, filename);
            downloadQueue.push({ imageUrl, filepath, filename });
        }
    }

    // Handle videos
    if (mediaType === 'all' || mediaType === 'videos') {
        if (p.embed?.$type === 'app.bsky.embed.video#view') {
            const did = p.author.did;
            const cid = p.embed.cid;
            const videoUrl = `${agent.service.origin}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;
            const extension = 'mp4'; // Assume mp4 for now
            const filename = `${postRkey}_video.${extension}`;
            const filepath = path.join(downloadPath, filename);
            downloadQueue.push({ imageUrl: videoUrl, filepath, filename });
        }
    }
  }

  if (downloadQueue.length === 0) {
    console.log(chalk.green("\n✅ No media found to download."));
    return;
  }

  console.log(chalk.cyan(`\nFound ${downloadQueue.length} media file(s). Starting parallel download...`));

  // --- Process Download Queue ---
  const concurrency = 10;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < downloadQueue.length; i += concurrency) {
    const chunk = downloadQueue.slice(i, i + concurrency);
    const promises = chunk.map(async (task) => {
      try {
        const res = await fetch(task.imageUrl);
        if (!res.ok) {
          throw new Error(`Failed to download: ${res.statusText}`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(task.filepath, buffer);
        return { status: 'fulfilled', filename: task.filename };
      } catch (err) {
        return { status: 'rejected', filename: task.filename, reason: err.message };
      }
    });

    const results = await Promise.all(promises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failCount++;
        console.warn(chalk.yellow(`  ⚠️ Failed to save ${result.filename}: ${result.reason}`));
      }
    }
    console.log(chalk.gray(`  Progress: ${successCount + failCount} / ${downloadQueue.length} (success: ${successCount}, failed: ${failCount})`));
  }

  console.log(chalk.green(`\n✅ Download complete! Saved ${successCount} media file(s) to ${downloadPath}.`));
  if (failCount > 0) {
    console.log(chalk.yellow(`  (${failCount} file(s) failed to download.)`));
  }
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

// ---------------- Nuke Logic ----------------

async function fetchAllRecords(agent, repo, collection) {
  const records = [];
  let cursor;
  while (true) {
    try {
      const res = await agent.com.atproto.repo.listRecords({
        repo,
        collection,
        limit: 100,
        cursor,
      });
      if (res.data.records.length === 0) break;
      records.push(...res.data.records);
      cursor = res.data.cursor;
      if (!cursor) break;
    } catch (err) {
      console.error(chalk.red(`❌ Could not fetch records: ${err.message}`));
      return []; // Return empty on error
    }
  }
  return records;
}

async function runNuke(agent, actor, settings) {
  const nukeType = settings.nuke;
  if (!nukeType) return;

  const typeMap = {
    "all-posts": "ALL POSTS",
    "media-posts": "ALL MEDIA POSTS",
    "text-posts": "ALL TEXT-ONLY POSTS",
    likes: "ALL LIKES",
  };

  const readableType = typeMap[nukeType];
  if (!readableType) {
    console.error(chalk.red(`❌ Invalid nuke type: ${nukeType}`));
    return;
  }

  console.log(chalk.red.bold("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"));
  console.log(chalk.red.bold("                      DANGER: NUKE MODE"));
  console.log(chalk.red.bold("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"));
  console.log(chalk.yellow(`\nThis will permanently delete ${readableType} from your account.`));
  console.log(chalk.yellow("This action is irreversible. There is no undo."));

  const confirm = await ask(`\n👉 To confirm, type exactly \"${nukeType}\" and press Enter: `);

  if (confirm !== nukeType) {
    console.log(chalk.cyan("\n🛑 Nuke cancelled. No action taken."));
    return;
  }

  console.log(chalk.cyan(`\n✅ Confirmation received. Preparing to nuke ${readableType}...`));

  const repo = agent.session.did; // The repo to modify is our own
  let records = [];
  let collection = "";
  let filterFn = () => true;

  if (nukeType === "likes") {
    collection = "app.bsky.feed.like";
  } else if (["all-posts", "media-posts", "text-posts"].includes(nukeType)) {
    collection = "app.bsky.feed.post";
    
    const baseFilter = (r) => {
        if (nukeType === "media-posts") return !!r.value.embed?.images;
        if (nukeType === "text-posts") return !r.value.embed?.images;
        return true;
    };

    const tagFilter = (r) => {
        const { filterTags, untaggedOnly } = settings;
        if (!filterTags && !untaggedOnly) return true; // No tag filter applied

        const postView = { record: r.value, labels: r.value.labels }; // Adapt record to look like a postView
        const allLabels = new Set();

        const moderationLabels = postView.labels || [];
        if (Array.isArray(moderationLabels)) {
          for (const label of moderationLabels) allLabels.add(label.val);
        }

        const selfLabelValues = postView.record?.labels?.values || [];
        if (Array.isArray(selfLabelValues)) {
          for (const label of selfLabelValues) allLabels.add(label.val);
        }

        if (untaggedOnly) {
          return allLabels.size === 0;
        }

        if (filterTags) {
          const filterTagSet = new Set(filterTags.split(",").map(t => t.trim()));
          for (const label of allLabels) {
            if (filterTagSet.has(label)) return true;
          }
          return false;
        }
        return true;
    };

    filterFn = (r) => baseFilter(r) && tagFilter(r);
  }

  console.log(chalk.cyan(`\nFetching all records...`));
  records = await fetchAllRecords(agent, repo, collection);

  const toDelete = records.filter(filterFn);

  if (toDelete.length === 0) {
    console.log(chalk.green("\n✅ No records to delete."));
    return;
  }

  console.log(chalk.yellow(`\nFound ${toDelete.length} item(s) to delete.`));

  let deletedCount = 0;
  const delay = settings.delay ?? 200; // Use a safe delay

  for (const record of toDelete) {
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo,
        collection,
        rkey: record.uri.split("/").pop(),
      });
      deletedCount++;
      console.log(`  (${deletedCount}/${toDelete.length}) Deleted ${record.uri}`);
      await sleep(delay);
    } catch (err) {
      console.error(chalk.red(`❌ Error deleting ${record.uri}: ${err.message}`));
      // Continue to next record
    }
  }

  console.log(chalk.green(`\n✅ Nuke complete. Deleted ${deletedCount} item(s).`));
}

// ---------------- Configuration Logic ----------------
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

  const wantsMediaFilter = await askYesNo("\nFilter media backups/nukes by content tags?", false);
  if (wantsMediaFilter) {
    const untaggedOnly = await askYesNo("Only act on media with NO tags?", false);
    if (untaggedOnly) {
      newSettings.untaggedOnly = true;
    } else {
      newSettings.filterTags = (await ask("\nEnter comma-separated tags to filter for (e.g. nudity, suggestive): ")).trim();
    }
  }

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
      await downloadAllMedia(agent, actor, config);
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
    "💥 Nuke content",
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

  // Helper function for asking about media filters
  async function askForMediaFilters() {
    const filters = {};
    const filterChoice = await askChoice("\nFilter by content tags?", [
        "No filter",
        "Only media with NO tags",
        "Suggestive",
        "Nudity",
        "Graphic Media",
        "Enter custom tags",
    ], 0);

    switch (filterChoice) {
        case "Only media with NO tags":
            filters.untaggedOnly = true;
            break;
        case "Suggestive":
            filters.filterTags = "suggestive";
            break;
        case "Nudity":
            filters.filterTags = "nudity";
            break;
        case "Graphic Media":
            filters.filterTags = "graphic-media";
            break;
        case "Enter custom tags":
            filters.filterTags = (await ask("\nEnter comma-separated tags to filter for: ")).trim();
            break;
    }
    return filters;
  }

  if (choice.startsWith("🕵️")) {
    // Run scan with safe, default settings
    await runFollowerScan(agent, actor, { ...config, simulate: true, pages: 0 });
  } else if (choice.startsWith("💾")) {
    const mediaFilters = await askForMediaFilters();
    const mediaTypeChoice = await askChoice("\nWhat type of media do you want to back up?", [
      "All media",
      "Photos only",
      "Videos only",
    ], 0);

    const mediaTypeMap = {
      "All media": "all",
      "Photos only": "photos",
      "Videos only": "videos",
    };
    const mediaType = mediaTypeMap[mediaTypeChoice];

    const defaultPath = path.join(os.homedir(), "Documents", "SkySweep_Backups");
    console.log(chalk.cyan(`\nMedia will be saved to: ${defaultPath}`))
    const downloadPathInput = await ask("Press Enter to confirm, or enter a different path: ");
    const downloadPath = downloadPathInput.trim() || defaultPath;

    if (downloadPath) {
      await downloadAllMedia(agent, actor, { ...config, ...mediaFilters, "media-type": mediaType, "download-media": downloadPath });
    }
  } else if (choice.startsWith("💥")) {
    const nukeType = await askChoice("\nWhat type of content do you want to nuke?", [
      "all-posts",
      "media-posts",
      "text-posts",
      "likes",
    ]);
    const mediaFilters = (nukeType.includes("post")) ? await askForMediaFilters() : {};
    await runNuke(agent, actor, { ...config, ...mediaFilters, nuke: nukeType });
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
    if (rl) {
      rl.close();
    }
  } catch {}
});
