process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const { XMLParser } = require("fast-xml-parser");
const { exec } = require("child_process");
const ALGORITHM = "aes-256-cbc";
const KEY = Buffer.from(process.env.PAT_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1gb" }));
app.use(express.urlencoded({ limit: "1gb", extended: true }));
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

function getTestResults(artifactName) {
  const EXTRACT_DIR = path.join(__dirname, "ExtractedReport", artifactName);

  const result = {
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
    },
    passedTests: [],
    failedTests: [],
  };

  const junitFile = fs.readdirSync(EXTRACT_DIR).find((f) => f.endsWith(".xml"));
  if (!junitFile) return result;

  const xml = fs.readFileSync(path.join(EXTRACT_DIR, junitFile), "utf8");
  const parser = new XMLParser({ ignoreAttributes: false });
  const report = parser.parse(xml);

  let counter = 1;
  function asArray(v) {
    if (!v) return [];

    return Array.isArray(v) ? v : [v];
  }

  asArray(report.testsuites?.testsuite).forEach((suite) => {
    asArray(suite.testcase).forEach((tc) => {
      result.summary.total++;
      const name = tc["@_name"];
      const classname = tc["@_classname"];

      // Split on ›
      const parts = name.split("›").map((p) => p.trim());
      const featureName = parts[0];
      let scenarioName = "";
      let example = null;

      if (parts.length === 3 && parts[2].startsWith("Example")) {
        scenarioName = parts[1];
        example = parts[2];
      } else {
        scenarioName = parts.slice(1).join(" › ");
      }

      const testObj = {
        id: counter++,
        classname,
        featureName,
        scenarioName,
        example,
      };

      if (tc.failure) {
        result.summary.failed++;
        result.failedTests.push({
          ...testObj,
          errorMessage: tc.failure?.["#text"] || null,
        });
      } else {
        result.summary.passed++;
        result.passedTests.push(testObj);
      }
    });
  });

  return result;
}

async function runPlaywright(titles, mode, env, workers = 1) {
  const grep = Array.isArray(titles) ? titles.map((t) => `(${escapeRegex(t)})`).join("|") : escapeRegex(titles);

  const cmd = `npx playwright test --grep "${grep}"${mode === "debug" ? " --debug" : ""} --workers=${workers}`;

  return new Promise((resolve) => {
    exec(
      cmd,
      {
        cwd: config.playwrightRepoPath,
        env: {
          ...process.env,
          TEST_ENV: env,
          HEADLESS: "false",
          RETRIES: "0",
        },
      },
      (err, stdout, stderr) => {
        if (err) {
          return resolve({
            success: false,
            logs: stderr || stdout,
          });
        }
        resolve({
          success: true,
          logs: stdout,
        });
      },
    );
  });
}

async function rerunfailedTests(tests, mode, env) {
  // 🐞 DEBUG MODE → ALWAYS SEQUENTIAL
  if (mode === "debug") {
    const results = [];

    for (const test of tests) {
      const title = buildPlaywrightTitle(test);

      console.log(`\n🔹 Debug run: ${title}`);

      const result = await runPlaywright(title, mode, env, 1);

      results.push({
        status: result.success ? "Passed" : "Failed",
        title,
        logs: result.logs,
      });
    }

    return results;
  }

  // 🚀 NON-DEBUG MODE
  // Multiple tests → run together with max 4 workers
  if (tests.length > 1) {
    const titles = tests.map(buildPlaywrightTitle);

    console.log(`\n🚀 Running ${titles.length} tests in parallel (max 4 workers)`);

    const result = await runPlaywright(titles, mode, env, 4);

    return titles.map((title) => ({
      status: result.success ? "Passed" : "Failed",
      title,
      logs: result.logs,
    }));
  }

  // 🧪 Single test → normal run
  const title = buildPlaywrightTitle(tests[0]);

  const result = await runPlaywright(title, mode, env, 1);

  return [
    {
      status: result.success ? "Passed" : "Failed",
      title,
      logs: result.logs,
    },
  ];
}

app.post("/getTests", async (req, res) => {
  const { user, projectId, buildId } = req.body;
  const artifactName = "junit-xml";
  const artifactFileName = "junit.xml";

  const base = `https://dev.azure.com/${process.env.AZURE_ORG}/${projectId}`;
  const artifactsUrl = `${base}/_apis/build/builds/${buildId}/artifacts?api-version=7.1-preview.5`;

  const authHeader = {
    Authorization: "Basic " + Buffer.from(`:${decryptPAT(user.pat)}`).toString("base64"),
  };

  const rootExtractDir = path.join(__dirname, "ExtractedReport");
  fs.rmSync(rootExtractDir, { recursive: true, force: true });
  fs.mkdirSync(rootExtractDir, { recursive: true });

  try {
    // 📊 Add timing logs
    console.log(`⏱️  Fetching artifacts list...`);
    const t1 = Date.now();

    const artifactsRes = await axios.get(artifactsUrl, { headers: authHeader });
    console.log(`✅ Artifacts list fetched in ${Date.now() - t1}ms`);

    const artifact = artifactsRes.data.value.find((a) => a.name === artifactName);

    if (!artifact) {
      return res.json({
        status: 404,
        data: [],
        error: `${artifactName} artifact not found`,
      });
    }

    const extractionDir = path.join(rootExtractDir, artifactName);
    fs.mkdirSync(extractionDir, { recursive: true });

    // 📊 Add download timing
    console.log(`⏱️  Downloading artifact...`);
    const t2 = Date.now();

    const response = await axios.get(artifact.resource.downloadUrl, {
      headers: authHeader,
      responseType: "stream",
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000, // 2 minute timeout
    });

    console.log(`✅ Download started in ${Date.now() - t2}ms`);

    // 📊 Extract timing
    const t3 = Date.now();
    await new Promise((resolve, reject) => {
      let found = false;

      response.data
        .pipe(unzipper.Parse())
        .on("entry", (entry) => {
          const fileName = entry.path;

          if (entry.type !== "Directory" && fileName === `${artifactName}/${artifactFileName}`) {
            found = true;
            const outputPath = path.join(extractionDir, artifactFileName);
            const writeStream = fs.createWriteStream(outputPath);

            // ✅ Fix: Handle both finish and close
            let finished = false;

            writeStream.on("finish", () => {
              finished = true;
            });

            writeStream.on("close", () => {
              if (finished) {
                console.log(`✅ File extracted in ${Date.now() - t3}ms`);
                resolve();
              }
            });

            writeStream.on("error", (err) => {
              reject(err);
            });

            entry.pipe(writeStream);
          } else {
            entry.autodrain();
          }
        })
        .on("close", () => {
          if (!found) {
            reject(new Error(`${artifactFileName} not found in artifact`));
          }
        })
        .on("error", reject);
    });

    const testResults = getTestResults(artifactName);

    res.json({
      status: 200,
      data: testResults,
    });
  } catch (error) {
    console.error("❌ Error in /getTests:", error.message);
    res.status(500).json({
      status: 500,
      data: [],
      error: error.message,
    });
  }
});

app.post("/rerun", async (req, res) => {
  const { tests, mode, env } = req.body;

  const r = await rerunfailedTests(tests, mode, env);

  res.json({ status: 200, data: r });
});

app.listen(4000, () => console.log("✅ Local Server listening on port 4000"));
