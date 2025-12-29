const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPlaywrightTitle(test) {
  // Example-based scenario
  if (test.example) {
    return `${test.featureName} ${test.scenarioName} ${test.example}`;
  }

  // Normal scenario
  return `${test.featureName} ${test.scenarioName}`;
}

async function runPlaywright(title, mode = "normal") {
  const safeTitle = escapeRegex(title);
  const cmd = mode === "debug" ? `npx playwright test --debug --grep "${safeTitle}"` : `npx playwright test --grep "${safeTitle}"`;

  // console.log(`▶ CMD: ${cmd}`);

  return new Promise((resolve) => {
    exec(cmd, { cwd: config.playwrightRepoPath }, (err, stdout, stderr) => {
      if (err) {
        // console.log(stdout);
        return resolve({
          success: false,
          title,
          logs: stderr || stdout,
        });
      }

      resolve({
        success: true,
        title,
        logs: stdout,
      });
    });
  });
}

async function rerunfailedTests(tests, mode) {
  for (const test of tests) {
    const title = buildPlaywrightTitle(test);

    console.log(`\n🔹 Running: ${test.featureName} › ${test.scenarioName}` + (test.example ? ` › ${test.example}` : ""));

    const result = await runPlaywright(title, mode);

    console.log(`${result.success ? "\n✅ PASSED" : "\n❌ FAILED"} → ${title}`);
  }

  console.log("\n🏁 Run completed.");
}

app.post("/rerun", async (req, res) => {
  const { tests, mode } = req.body;

  await rerunfailedTests(tests, mode);

  res.json({ status: 200, data: mode === "debug" ? "Please check if browser and debug console are opened." : "Please check local-runner console for rerun progress/result." });
});

app.listen(4000, () => console.log("✅ Local Runner listening on port 4000"));
