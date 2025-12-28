require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { XMLParser } = require("fast-xml-parser");
const cors = require("cors");
const { hashPassword, verifyPassword, encryptPAT, decryptPAT } = require("./utils/crypto");

const app = express();
app.use(
  cors({
    origin: process.env.SERVER_URL,
    credentials: true,
  })
);
app.use(express.json());

const DB_PATH = path.join(__dirname, "db", "data.json");

/* ---------------- Helpers ---------------- */
function loadDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getDateRange(range) {
  const now = new Date();
  let from, to;

  switch (range) {
    case "yesterday":
      from = new Date();
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to = new Date(from);
      to.setHours(23, 59, 59, 999);
      break;

    case "current_week":
      from = new Date();
      from.setDate(from.getDate() - from.getDay());
      from.setHours(0, 0, 0, 0);
      to = now;
      break;

    case "last_week":
      from = new Date();
      from.setDate(from.getDate() - from.getDay() - 7);
      from.setHours(0, 0, 0, 0);
      to = new Date(from);
      to.setDate(to.getDate() + 6);
      to.setHours(23, 59, 59, 999);
      break;

    case "current_month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
      break;

    default:
      return null; // ❌ Invalid or missing filter
  }

  return { from, to };
}

function getFailedTests() {
  const EXTRACT_DIR = path.join(__dirname, "ExtractedReport", "junit-xml");

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
  // const failedSpecs = new Set();
  const failedTests = [];
  let counter = 0;
  asArray(report.testsuites?.testsuite).forEach((suite) => {
    asArray(suite.testcase).forEach((tc) => {
      if (tc.failure) {
        // Split JUnit name into feature + scenario
        const [featureName, scenarioName] = tc["@_name"].split(" › ").map((s) => s.trim());
        // failedSpecs.add(featureName + " " + scenarioName); // only scenario
        failedTests.push({
          id: ++counter,
          classname: tc["@_classname"], // path like Features/example.feature.spec.js
          featureName,
          scenarioName,
        });
      }
    });
  });

  return failedTests;
}

/* ---------------- Teams ------------------ */
app.get("/teams", (_, res) => {
  res.json(loadDB().teams);
});

/* ---------------- Users ------------------ */
app.get("/users", (req, res) => {
  const { team } = req.query;

  if (!team) {
    return res.status(400).json({ error: "team is required" });
  }

  const db = loadDB();

  const users = db.users
    .filter((u) => u.team === team)
    .map((u) => ({
      id: u.id,
      username: u.username,
    }));

  res.json(users);
});

/* ---------------- Register --------------- */
app.post("/register", async (req, res) => {
  const { team, username, firstName, lastName, password } = req.body;

  const db = loadDB();
  const exists = db.users.some((u) => u.team === team && u.username === username);

  if (exists) {
    return res.json({ status: 409, error: "User already exists" });
  }

  const user = {
    id: crypto.randomUUID(),
    team,
    username,
    firstName,
    lastName,
    password: await hashPassword(password),
    pat: "",
  };

  db.users.push(user);
  saveDB(db);

  res.json({ status: "REGISTERED" });
});

/* ---------------- Login ------------------ */
app.post("/login", async (req, res) => {
  const { team, username, password } = req.body;

  const db = loadDB();

  const user = db.users.find((u) => u.team === team && u.username === username);

  if (!user || !(await verifyPassword(password, user.password))) {
    return res.json({ status: 401, error: "Invalid credentials" });
  }

  // Never send password back
  const { password: _, ...safeUser } = user;
  res.json({ status: 200, data: safeUser });
});

/* ---------------- Get Profile ------------ */
app.get("/profile/:userId", (req, res) => {
  const { userId } = req.params;

  const db = loadDB();
  const user = db.users.find((u) => u.id === userId);

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    userId: user.id,
    username: user.username,
    team: user.team,
    firstName: user.firstName,
    lastName: user.lastName,
    hasPAT: Boolean(user.pat), // 🔒 never send PAT itself
  });
});

/* ---------------- Update Password -------- */
app.put("/password", async (req, res) => {
  const { userId, current, password } = req.body;

  const db = loadDB();
  const user = db.users.find((u) => u.id === userId);

  const isValid = await verifyPassword(current, user.password);
  if (!isValid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  user.password = await hashPassword(password);
  saveDB(db);

  res.json({ status: 200 });
});

/* ---------------- Update Profile --------- */
app.put("/profile", async (req, res) => {
  const { userId, firstName, lastName, pat } = req.body;

  const db = loadDB();
  const user = db.users.find((u) => u.id === userId);

  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (pat) user.pat = encryptPAT(pat, user.id);

  saveDB(db);
  res.json({ status: 200, data: user });
});

/* ---------------- Get Projects ----------- */
app.post("/projects", async (req, res) => {
  const { user } = req.body;
  const authHeader = {
    Authorization: "Basic " + Buffer.from(`:${decryptPAT(user.pat)}`).toString("base64"),
  };
  const url = `https://dev.azure.com/${process.env.AZURE_ORG}/_apis/projects?api-version=7.1-preview.4`;
  const r = await axios.get(url, { headers: authHeader });
  res.json({ status: r.status, data: r.data.value });
});

/* ---------------- Get Builds ------------- */
app.post("/builds", async (req, res) => {
  try {
    const { user } = req.body;
    const { project, range } = req.query;

    // ❌ No filter → no builds
    const dateRange = getDateRange(range);
    if (!dateRange) {
      return res.json([]); // ✅ important change
    }

    const authHeader = {
      Authorization: "Basic " + Buffer.from(`:${decryptPAT(user.pat)}`).toString("base64"),
    };
    if (!project) {
      return res.status(400).json({ error: "project required" });
    }

    const base = `https://dev.azure.com/${process.env.AZURE_ORG}/${project}`;

    // 1. Get builds
    const buildsRes = await axios.get(`${base}/_apis/build/builds?api-version=7.1-preview.7`, { headers: authHeader });

    const builds = buildsRes.data.value.filter((b) => {
      if (!b.finishTime) return false;
      const finish = new Date(b.finishTime);
      return finish >= dateRange.from && finish <= dateRange.to;
    });

    // 2. Enrich with failed test count
    const enriched = await Promise.all(
      builds.map(async (b) => {
        try {
          const runsRes = await axios.get(`${base}/_apis/test/runs?buildIds=${b.id}&api-version=7.1-preview.7`, { headers: authHeader });

          return {
            buildId: b.id,
            pipelineName: b.definition?.name,
            result: b.result,
            status: b.status,
          };
        } catch {
          return {
            buildId: b.id,
            pipelineName: b.definition?.name,
            result: b.result,
            status: b.status,
          };
        }
      })
    );

    res.json({ status: 200, data: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------------- Download Report -------- */
app.post("/tests", async (req, res) => {
  const { user, projectId, buildId } = req.body;

  const base = `https://dev.azure.com/${process.env.AZURE_ORG}/${projectId}`;
  const artifactsUrl = `${base}/_apis/build/builds/${buildId}/artifacts?api-version=7.1-preview.5`;

  const authHeader = {
    Authorization: "Basic " + Buffer.from(`:${decryptPAT(user.pat)}`).toString("base64"),
  };
  const artifactsRes = await axios.get(artifactsUrl, {
    headers: authHeader,
  });

  const artifact = artifactsRes.data.value.find((a) => a.name === "junit-xml");

  if (!artifact) {
    return res.json({ status: 404, data: [], error: "junit-xml artifact not found" });
  }

  const zipRes = await axios.get(artifact.resource.downloadUrl, {
    headers: authHeader,
    responseType: "arraybuffer",
  });

  const utilitiesDirOnServer = path.join(process.cwd(), "./Utils");
  fs.mkdirSync(utilitiesDirOnServer, { recursive: true });
  const zipPathOnServer = path.join(utilitiesDirOnServer, "junit.zip");
  fs.writeFileSync(zipPathOnServer, zipRes.data);
  const failedTestDir = path.join(__dirname, "ExtractedReport");

  fs.rmSync(failedTestDir, { recursive: true, force: true });
  fs.mkdirSync(failedTestDir, { recursive: true });
  new AdmZip(zipPathOnServer).extractAllTo(failedTestDir, true);
  const failedTests = getFailedTests() || [];

  res.json({ status: 200, data: failedTests });
});

app.listen(3001, () => console.log("✅ Backend running on port 3001"));
