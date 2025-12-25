require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
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

/* ---------------- Teams ---------------- */
app.get("/teams", (_, res) => {
  res.json(loadDB().teams);
});

/* ---------------- Users ---------------- */
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

/* ---------------- Register ---------------- */
app.post("/register", async (req, res) => {
  const { team, username, firstName, lastName, password } = req.body;

  if (!team || !username || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const db = loadDB();

  const exists = db.users.some((u) => u.team === team && u.username === username);

  if (exists) {
    return res.status(409).json({ error: "User already exists" });
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

/* ---------------- Login ---------------- */
app.post("/login", async (req, res) => {
  const { team, username, password } = req.body;

  const db = loadDB();

  const user = db.users.find((u) => u.team === team && u.username === username);

  if (!user || !(await verifyPassword(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Never send password back
  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

/* ---------------- Get Profile ---------------- */
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

/* ---------------- Update Password ---------------- */
app.put("/password", async (req, res) => {
  const { userId, current, password } = req.body;

  const db = loadDB();
  const user = db.users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const isValid = await verifyPassword(current, user.password);
  if (!isValid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  user.password = await hashPassword(password);
  saveDB(db);

  res.json({ status: "UPDATED" });
});

/* ---------------- Update Profile ---------------- */
app.put("/profile", async (req, res) => {
  const { userId, firstName, lastName, pat } = req.body;

  const db = loadDB();
  const user = db.users.find((u) => u.id === userId);

  if (!user) return res.status(404).json({ error: "User not found" });

  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (pat) user.pat = encryptPAT(pat, user.id);

  saveDB(db);
  res.json({ user });
});

app.post("/projects", async (req, res) => {
  try {
    const { user } = req.body;
    const authHeader = {
      Authorization: "Basic " + Buffer.from(`:${decryptPAT(user.pat)}`).toString("base64"),
    };
    const url = `https://dev.azure.com/${process.env.AZURE_ORG}/_apis/projects?api-version=7.1-preview.4`;
    const r = await axios.get(url, { headers: authHeader });
    res.json(r.data.value);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/builds", async (req, res) => {
  try {
    const { user } = req.body;
    const { project } = req.query;
    const authHeader = {
      Authorization: "Basic " + Buffer.from(`:${decryptPAT(user.pat)}`).toString("base64"),
    };
    if (!project) {
      return res.status(400).json({ error: "project required" });
    }

    const base = `https://dev.azure.com/${process.env.AZURE_ORG}/${project}`;

    // 1. Get builds
    const buildsRes = await axios.get(`${base}/_apis/build/builds?api-version=7.1-preview.7`, { headers: authHeader });

    const builds = buildsRes.data.value;

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

    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/download", async (req, res) => {
  try {
    const { project, buildId } = req.body;
    if (!project || !buildId) {
      return res.status(400).json({ error: "project & buildId required" });
    }

    const base = `https://dev.azure.com/${process.env.AZURE_ORG}/${project}`;
    const artifactsUrl = `${base}/_apis/build/builds/${buildId}/artifacts?api-version=7.1-preview.5`;

    const artifactsRes = await axios.get(artifactsUrl, {
      headers: authHeader,
    });

    const artifact = artifactsRes.data.value.find((a) => a.name === "junit-xml");

    if (!artifact) {
      return res.status(404).json({ error: "junit-xml artifact not found" });
    }

    const zipRes = await axios.get(artifact.resource.downloadUrl, {
      headers: authHeader,
      responseType: "arraybuffer",
    });

    const utilitiesDir = path.join(process.cwd(), "../local-runner/Utilities");
    fs.mkdirSync(utilitiesDir, { recursive: true });

    const zipPath = path.join(utilitiesDir, "junit.zip");
    fs.writeFileSync(zipPath, zipRes.data);

    res.json({ status: "DOWNLOADED", zipPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3001, () => console.log("✅ Backend running on port 3001"));
