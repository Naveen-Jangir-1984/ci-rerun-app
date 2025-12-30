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

async function runPlaywright(title, mode, env) {
  const safeTitle = escapeRegex(title);
  const cmd = `npx playwright test --grep "${safeTitle}"${mode === "debug" ? " --debug" : ""}`;

  // console.log(`▶ CMD: ${cmd}`);

  return new Promise((resolve) => {
    exec(
      cmd,
      {
        cwd: config.playwrightRepoPath,
        env: Object.assign({}, process.env, {
          TEST_ENV: env,
        }),
      },
      (err, stdout, stderr) => {
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
      }
    );
  });
}

async function rerunfailedTests(tests, mode, env) {
  let results = [];
  for (const test of tests) {
    const title = buildPlaywrightTitle(test);

    console.log(`\n🔹 Running: ${test.featureName} › ${test.scenarioName}` + (test.example ? ` › ${test.example}` : ""));

    const result = await runPlaywright(title, mode, env);

    console.log(`${result.success ? "\n✅ PASSED" : "\n❌ FAILED"} → ${title}`);
    results.push({ status: result.success ? "Passed" : "Failed", title: result.title, logs: result.logs });
  }

  console.log("\n🏁 Run completed.");
  return results;
}

app.post("/rerun", async (req, res) => {
  const { tests, mode, env } = req.body;
  console.log(env);

  const r = await rerunfailedTests(tests, mode, env);

  res.json({ status: 200, data: r });
});

app.listen(4000, () => console.log("✅ Local Runner listening on port 4000"));
