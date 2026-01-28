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
const ExcelJS = require("exceljs");
const ALGORITHM = "aes-256-cbc";
const KEY = Buffer.from(process.env.PAT_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1gb" }));
app.use(express.urlencoded({ limit: "1gb", extended: true }));
const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

/* ---------------- Configuration ---------- */
const CONFIG = {
  AZURE_TIMEOUT: 120000, // 120 seconds (artifact downloads can be large)
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // Start with 1 second
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_CONCURRENT_REQUESTS: 5,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 30,
};

/* ---------------- Cache & Rate Limiting -- */
const cache = new Map();
const requestQueue = [];
let activeRequests = 0;
const rateLimitMap = new Map();

// Axios instance with timeout and keep-alive
const axiosInstance = axios.create({
  timeout: CONFIG.AZURE_TIMEOUT,
  headers: {
    Connection: "keep-alive",
  },
  maxRedirects: 5,
});

/* ---------------- Helpers ---------------- */
// Sleep helper for retry delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Cache helper
const getCacheKey = (url, params = {}) => {
  return `${url}:${JSON.stringify(params)}`;
};

const getFromCache = (key) => {
  const cached = cache.get(key);
  if (!cached) return null;

  const { data, timestamp } = cached;
  if (Date.now() - timestamp > CONFIG.CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return data;
};

const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });

  // Cleanup old cache entries (keep max 50 items)
  if (cache.size > 50) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
};

// Rate limiting helper
const checkRateLimit = (userId) => {
  const now = Date.now();
  const userRequests = rateLimitMap.get(userId) || [];

  // Remove old requests outside the window
  const recentRequests = userRequests.filter((timestamp) => now - timestamp < CONFIG.RATE_LIMIT_WINDOW);

  if (recentRequests.length >= CONFIG.RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  recentRequests.push(now);
  rateLimitMap.set(userId, recentRequests);
  return true;
};

// Retry helper with exponential backoff
const retryWithBackoff = async (fn, retries = CONFIG.MAX_RETRIES) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const isRetryable = error.code === "ECONNABORTED" || error.code === "ETIMEDOUT" || error.code === "ENOTFOUND" || (error.response && error.response.status >= 500) || (error.response && error.response.status === 429);

      if (isLastAttempt || !isRetryable) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = CONFIG.RETRY_DELAY * Math.pow(2, attempt);
      console.log(`⚠️ Retry attempt ${attempt + 1}/${retries} after ${delay}ms - ${error.message}`);
      await sleep(delay);
    }
  }
};

// Request queue manager
const executeWithQueue = async (fn) => {
  if (activeRequests >= CONFIG.MAX_CONCURRENT_REQUESTS) {
    // Queue the request
    await new Promise((resolve) => {
      requestQueue.push(resolve);
    });
  }

  activeRequests++;

  try {
    return await fn();
  } finally {
    activeRequests--;

    // Process next queued request
    if (requestQueue.length > 0) {
      const next = requestQueue.shift();
      next();
    }
  }
};

// Azure API call wrapper with retry, caching, and queuing
const azureApiCall = async (url, options = {}, cacheKey = null) => {
  // Check cache first
  if (cacheKey) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log(`✓ Cache hit: ${cacheKey.substring(0, 50)}...`);
      return cached;
    }
  }

  // Execute with queue management
  return executeWithQueue(async () => {
    // Execute with retry logic
    const result = await retryWithBackoff(async () => {
      const response = await axiosInstance(url, options);
      return response;
    });

    // Cache successful responses
    if (cacheKey && result.status === 200) {
      setCache(cacheKey, result);
    }

    return result;
  });
};

const decryptPAT = (encryptedText) => {
  if (!encryptedText) return "";

  const [ivHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const buildPlaywrightTitle = (test) => {
  // Example-based scenario
  if (test.example) {
    return `${test.featureName} ${test.scenarioName} ${test.example}`;
  }
  // Normal scenario
  return `${test.featureName} ${test.scenarioName}`;
};

const getTestResults = (junitFilePath) => {
  const result = {
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
    },
    passedTests: [],
    failedTests: [],
  };

  if (!fs.existsSync(junitFilePath)) {
    console.warn(`⚠️ JUnit file not found at ${junitFilePath}`);
    return result;
  }

  const xml = fs.readFileSync(junitFilePath, "utf8");
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
};

const runPlaywright = async (titles, mode, env, workers = 1) => {
  const grep = Array.isArray(titles) ? titles.map((t) => `(${escapeRegex(t)}(?!\\d))`).join("|") : `${escapeRegex(titles)}(?!\\d)`;

  const cmd = `npx playwright test --grep "${grep}"${mode === "debug" ? " --debug" : ""} --workers=${workers}`;
  console.log(`\n▶️  Executing: ${cmd}\n`);

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
};

const rerunfailedTests = async (tests, mode, env) => {
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
};

app.get("/health", (_, res) => {
  res.json({ status: "OK" });
});

app.post("/getTests", async (req, res) => {
  try {
    const { user, projectId, buildId } = req.body;

    if (!user || !user.id) {
      return res.status(400).json({ status: 400, error: "User information required" });
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return res.status(429).json({
        status: 429,
        error: "Too many requests. Please wait a moment and try again.",
      });
    }

    const artifactFolderName = "junit-report";
    const artifactFileName = "junit.xml";

    const base = `https://dev.azure.com/${process.env.AZURE_ORG}/${projectId}`;
    const artifactsUrl = `${base}/_apis/build/builds/${buildId}/artifacts?api-version=7.1-preview.5`;

    const authHeader = {
      Authorization: "Basic " + Buffer.from(`:${decryptPAT(user.pat)}`).toString("base64"),
    };

    const extractDir = path.join(__dirname, "ExtractedReport");
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });

    // 1️⃣ Get artifacts list with retry and caching
    const cacheKey = getCacheKey(artifactsUrl, { buildId });
    const artifactsRes = await azureApiCall(artifactsUrl, { method: "GET", headers: authHeader }, cacheKey);

    // 🔥 Take the FIRST artifact (since only one exists)
    const artifact = artifactsRes.data.value[0];

    if (!artifact || artifact.name !== artifactFolderName) {
      return res.json({
        status: 404,
        data: [],
        error: `${artifactFolderName}/${artifactFileName} artifact NOT FOUND for this build`,
      });
    }

    // 2️⃣ Download artifact ZIP with retry logic
    console.log(`📥 Downloading artifact for build ${buildId}...`);
    const response = await retryWithBackoff(async () => {
      return await axiosInstance.get(artifact.resource.downloadUrl, {
        headers: authHeader,
        responseType: "stream",
        timeout: CONFIG.AZURE_TIMEOUT,
      });
    });

    // 3️⃣ Extract junit.xml directly
    const outputPath = path.join(extractDir, artifactFileName);

    await new Promise((resolve, reject) => {
      response.data.pipe(unzipper.ParseOne(artifactFileName)).pipe(fs.createWriteStream(outputPath)).on("finish", resolve).on("error", reject);
    });

    // 4️⃣ Parse results
    const testResults = getTestResults(outputPath);

    res.json({
      status: 200,
      data: testResults,
    });
  } catch (error) {
    console.error("❌ Error in /getTests:", error.message);

    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return res.status(504).json({
        status: 504,
        data: [],
        error: "Azure API request timed out. Please try again.",
      });
    }

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      data: [],
      error: error.message || "Failed to fetch test results",
    });
  }
});

app.post("/rerun", async (req, res) => {
  const { tests, mode, env } = req.body;

  const r = await rerunfailedTests(tests, mode, env);

  res.json({ status: 200, data: r });
});

app.post("/downloadFailures", async (req, res) => {
  const { buildId, tests } = req.body;

  try {
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Test Results");

    // Add headers
    worksheet.columns = [
      { header: "Build ID", key: "buildId", width: 15 },
      { header: "Class Name", key: "classname", width: 50 },
      { header: "Feature Name", key: "featureName", width: 50 },
      { header: "Scenario Name", key: "scenarioName", width: 50 },
      { header: "Example", key: "example", width: 15 },
    ];

    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "left", wrapText: true };

    // Apply alignment and wrap text to all cells
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      });
    });

    // Add data rows
    tests.forEach((test) => {
      worksheet.addRow({
        buildId: `#${buildId}` || "",
        classname: test.classname || "",
        featureName: test.featureName || "",
        scenarioName: test.scenarioName || "",
        example: test.example || "",
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Send file
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=test-results.xlsx");
    res.send(buffer);
  } catch (error) {
    console.error("❌ Error in /download:", error.message);
    res.json({
      status: 500,
      error: error.message,
    });
  }
});

app.post("/downloadResults", async (req, res) => {
  const { results } = req.body;

  try {
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Rerun Results");

    // Add headers
    worksheet.columns = [
      { header: "S.No", key: "sno", width: 5 },
      { header: "Build Number", key: "build", width: 10 },
      { header: "Pipeline Name", key: "pipeline", width: 30 },
      { header: "Class Name", key: "classname", width: 50 },
      { header: "Feature Name", key: "featureName", width: 50 },
      { header: "Scenario Name", key: "scenarioName", width: 50 },
      { header: "Example", key: "example", width: 15 },
      { header: "Failed On", key: "failedOn", width: 20 },
      { header: "Reran On Environment", key: "reranEnv", width: 10 },
      { header: "Reran On Date", key: "reranOn", width: 20 },
      { header: "Reran Status", key: "reranStatus", width: 10 },
    ];

    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "left", wrapText: true };

    // Apply alignment and wrap text to all cells
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      });
    });

    // Add data rows
    let counter = 1;
    results.forEach((result) => {
      worksheet.addRow({
        sno: counter++,
        build: result.build.buildId || "",
        pipeline: result.build.pipelineName || "",
        classname: result.test.classname || "",
        featureName: result.test.featureName || "",
        scenarioName: result.test.scenarioName || "",
        example: result.test.example || "",
        failedOn: result.build.date || "",
        reranEnv: result.env.toUpperCase() || "",
        reranOn: result.date || "",
        reranStatus: result.status || "",
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Send file
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=rerun-results.xlsx");
    res.send(buffer);
  } catch (error) {
    console.error("❌ Error in /downloadResults:", error.message);
    res.json({
      status: 500,
      error: error.message,
    });
  }
});

app.listen(4000, () => console.log("✅ Local Server listening on port 4000"));
