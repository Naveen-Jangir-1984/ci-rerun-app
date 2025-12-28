const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

function runPlaywright(title, mode) {
  const command = mode === "debug" ? `npx playwright test --debug --grep "${title}"` : `npx playwright test --grep "${title}"`;
  return new Promise((resolve) => {
    const child = exec(`${command}`, { cwd: config.playwrightRepoPath }, (err, stdout, stderr) => {
      if (err) {
        console.log("❌ Test failed (but server continues)");
      }
      console.log(stdout);
    });
  });
}

async function rerunfailedTests(tests, mode) {
  const results = [];

  tests.forEach(async (test) => {
    const title = `${test.featureName} ${test.scenarioName}`;
    console.log(`\n🔹 Re-running: ${title}`);
    const result = await runPlaywright(title, mode);
    results.push(result);
  });

  results.forEach((r) => console.log(`${r.success ? "✅" : "❌"} ${r.title}`));
}

app.post("/rerun", async (req, res) => {
  const { tests, mode } = req.body;

  rerunfailedTests(tests, mode);

  res.json({ status: 200, data: mode === "debug" ? "Please check if browser and debug console are opened." : "Please check local-runner console for rerun progress/result." });
});

app.listen(4000, () => console.log("✅ Local Runner listening on port 4000"));
