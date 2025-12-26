const express = require("express");
const cors = require("cors");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { XMLParser } = require("fast-xml-parser");
const { exec } = require("child_process");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const UTIL = path.join(__dirname, "Utilities");

async function mappingFailedTests() {
  const EXTRACT_DIR = path.join(UTIL, "extracted", "junit-xml");
  const FAILED_FILE = path.join(UTIL, "failed-tests", "tests.txt");

  const junitFile = fs.readdirSync(EXTRACT_DIR).find((f) => f.endsWith(".xml"));

  if (!junitFile) throw new Error("No JUnit XML found");

  const xml = fs.readFileSync(path.join(EXTRACT_DIR, junitFile), "utf8");
  const parser = new XMLParser({ ignoreAttributes: false });
  const report = parser.parse(xml);

  function asArray(v) {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  }

  // Step 1: Extract failed testcases
  const failedSpecs = new Set();
  const failedTests = [];
  asArray(report.testsuites?.testsuite).forEach((suite) => {
    asArray(suite.testcase).forEach((tc) => {
      if (tc.failure) {
        // Split JUnit name into feature + scenario
        const [featureName, scenarioName] = tc["@_name"].split(" › ").map((s) => s.trim());
        failedSpecs.add(featureName + " " + scenarioName); // only scenario
        failedTests.push({
          classname: tc["@_classname"], // path like Features/example.feature.spec.js
          featureName,
          scenarioName,
        });
      }
    });
  });

  // Step 2: Write failed-tests.txt
  fs.writeFileSync(FAILED_FILE, [...failedSpecs].join("\n"));
}

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

async function rerunfailedTests(mode) {
  const failedTests = fs.readFileSync(path.join(UTIL, "failed-tests", "tests.txt"), "utf8").split("\n").filter(Boolean);

  const results = [];

  for (const title of failedTests) {
    console.log(`\n🔹 Re-running: ${title}`);
    const result = await runPlaywright(title, mode);
    results.push(result);
  }

  console.log("\n🧪 RERUN SUMMARY");
  results.forEach((r) => console.log(`${r.success ? "✅" : "❌"} ${r.title}`));
}

app.post("/rerun", async (req, res) => {
  try {
    const { mode } = req.body;
    const zipPath = path.join(UTIL, "junit.zip");
    const extractDir = path.join(UTIL, "extracted");

    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });

    new AdmZip(zipPath).extractAllTo(extractDir, true);

    mappingFailedTests();
    rerunfailedTests(mode);

    res.json({ status: mode === "debug" ? "Please check if browser and debug console is opened." : "Please check your local-runner console for rerun progress/result." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(4000, () => console.log("✅ Local Runner listening on port 4000"));
