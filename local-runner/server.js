process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { XMLParser } = require("fast-xml-parser");
const { exec } = require("child_process");
const ALGORITHM = "aes-256-cbc";
const KEY = Buffer.from(process.env.PAT_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

function decryptPAT(encryptedText) {
  if (!encryptedText) return "";

  const [ivHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

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

function getFailedTests(artifactName) {
  const EXTRACT_DIR = path.join(__dirname, "ExtractedReport", artifactName);

  const junitFile = fs.readdirSync(EXTRACT_DIR).find((f) => f.endsWith(".xml"));
  if (!junitFile) throw new Error("No JUnit XML found");

  const xml = fs.readFileSync(path.join(EXTRACT_DIR, junitFile), "utf8");
  const parser = new XMLParser({ ignoreAttributes: false });
  const report = parser.parse(xml);

  const failedTests = [];
  let counter = 1;
  function asArray(v) {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  }

  asArray(report.testsuites?.testsuite).forEach((suite) => {
    asArray(suite.testcase).forEach((tc) => {
      if (!tc.failure) return;

      const name = tc["@_name"];
      const classname = tc["@_classname"];

      // Split on ›
      const parts = name.split("›").map((p) => p.trim());

      const featureName = parts[0];
      let scenarioName = "";
      let example = null;

      if (parts.length === 3 && parts[2].startsWith("Example")) {
        // Scenario Outline
        scenarioName = parts[1];
        example = parts[2]; // Example #3
      } else {
        // Normal Scenario
        scenarioName = parts.slice(1).join(" › ");
      }

      failedTests.push({
        id: counter++,
        classname,
        featureName,
        scenarioName,
        example,
      });
    });
  });

  return failedTests;
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

app.post("/getTests", async (req, res) => {
  const { user, projectId, buildId } = req.body;
  const artifactName = "junit-xml";

  const base = `https://dev.azure.com/${process.env.AZURE_ORG}/${projectId}`;
  const artifactsUrl = `${base}/_apis/build/builds/${buildId}/artifacts?api-version=7.1-preview.5`;

  const authHeader = {
    Authorization: "Basic " + Buffer.from(`:${decryptPAT(user.pat)}`).toString("base64"),
  };
  const artifactsRes = await axios.get(artifactsUrl, {
    headers: authHeader,
  });

  const artifact = artifactsRes.data.value.find((a) => a.name === artifactName);

  if (!artifact) {
    return res.json({ status: 404, data: [], error: `${artifactName} artifact not found` });
  }

  const zipRes = await axios.get(artifact.resource.downloadUrl, {
    headers: authHeader,
    responseType: "arraybuffer",
  });

  const extractionDir = path.join(process.cwd(), "ExtractedReport");
  fs.mkdirSync(extractionDir, { recursive: true });
  const zipPath = path.join(extractionDir, "junit.zip");
  fs.writeFileSync(zipPath, zipRes.data);

  new AdmZip(zipPath).extractAllTo(extractionDir, true);
  const failedTests = getFailedTests(artifactName) || [];

  res.json({ status: 200, data: failedTests });
});

app.post("/rerun", async (req, res) => {
  const { tests, mode, env } = req.body;

  const r = await rerunfailedTests(tests, mode, env);

  res.json({ status: 200, data: r });
});

app.listen(4000, () => console.log("✅ Local Runner listening on port 4000"));
