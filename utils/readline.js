import readline from "readline";

export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

export async function askHidden(prompt) {
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

// Graceful Ctrl+C
process.on("SIGINT", () => {
  console.log("\n👋 Cancelled.");
  try {
    rl.close();
  } catch {} 
  process.exit(0);
});

