// utils/args.js
import chalk from "chalk";

export function parseArgs(argv, schema) {
  // schema: { flagName: { type: 'bool'|'string'|'number', alias?: string, default?: any, desc?: string } }
  const out = {};
  const indexByAlias = {};
  for (const [key, cfg] of Object.entries(schema)) {
    out[key] = cfg.default;
    if (cfg.alias) indexByAlias[cfg.alias] = key;
  }

  for (let i = 0; i < argv.length; i++) {
    let token = argv[i];
    if (!token.startsWith("-")) continue;

    // normalize --flag / -f
    token = token.replace(/^--?/, "");
    const key = schema[token] ? token : indexByAlias[token];
    if (!key) continue;

    const cfg = schema[key];
    if (cfg.type === "bool") {
      out[key] = true;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("-")) continue; // value missing, keep default
    i++; // consume value

    if (cfg.type === "number") {
      const n = Number(next);
      if (Number.isFinite(n)) out[key] = n;
    } else {
      out[key] = next;
    }
  }

  return out;
}

export function buildHelp(title, examples, schema) {
  const lines = [];
  lines.push(`${chalk.bold(title)}\n`);
  lines.push("Usage:");
  lines.push(`  node index.js [flags]\n`);
  lines.push("Flags:");

  const keycol = 28;
  const entries = Object.entries(schema).map(([k, v]) => {
    const head = `${chalk.bold(`--${k}`)}${
      v.alias ? `, ${chalk.bold("-" + v.alias)}` : ""
    }`;
    const typeHint =
      v.type === "bool" ? "" : ` <${v.type === "number" ? "n" : "value"}>`;
    const pad = " ".repeat(
      Math.max(1, keycol - (head.length + typeHint.length))
    );
    const def =
      v.default === undefined
        ? ""
        : ` (default ${v.default === Infinity ? "∞" : String(v.default)})`;
    return `  ${head}${typeHint}${pad}${v.desc ?? ""}${def}`;
  });

  lines.push(...entries, "");
  if (examples?.length) {
    lines.push("Examples:");
    for (const ex of examples) lines.push(`  ${ex}`);
  }
  return lines.join("\n");
}
