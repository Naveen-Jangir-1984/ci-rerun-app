const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { exec } = require("child_process");
const AdmZip = require("adm-zip");
const { XMLParser } = require("fast-xml-parser");
const { execSync } = require("child_process");
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
        failedSpecs.add(scenarioName); // only scenario
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
  console.log(`✅ Failed tests written to ${FAILED_FILE}`);
}

async function rerunfailedTests() {
  const failedTests = fs.readFileSync(path.join(UTIL, "failed-tests", "tests.txt"), "utf8").split("\n").filter(Boolean);

  failedTests.forEach((title) => {
    console.log(`\n🔹 Running: ${title}`);
    execSync(`npx playwright test --grep "${title}" --debug`, {
      cwd: config.playwrightRepoPath,
      stdio: "inherit",
    });
  });
}

app.post("/rerun", async (req, res) => {
  try {
    const zipPath = path.join(UTIL, "junit.zip");
    const extractDir = path.join(UTIL, "extracted");

    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });

    new AdmZip(zipPath).extractAllTo(extractDir, true);

    mappingFailedTests();
    rerunfailedTests();

    // const suite = report.testsuites.testsuite;
    // const cases = Array.isArray(suite.testcase) ? suite.testcase : [suite.testcase];
    // console.log("4✅ Test cases extracted");

    // const failed = cases.filter((tc) => tc.failure).map((tc) => tc["@_name"]);
    // console.log("5✅ Failed test cases identified");

    // if (!failed.length) {
    //   return res.json({ status: "NO_FAILURES" });
    // }

    // const grep = failed.join("|").replace(/"/g, '\\"');

    // exec(
    //   `npx playwright test --grep "${grep}"`,
    //   {
    //     cwd: config.playwrightRepoPath,
    //   },
    //   (err, stdout, stderr) => {
    //     if (err) {
    //       return res.json({ status: "FAILED", logs: stderr });
    //     }
    //     res.json({ status: "SUCCESS", logs: stdout });
    //   }
    // );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(4000, () => console.log("✅ Local Runner listening on http://localhost:4000"));
