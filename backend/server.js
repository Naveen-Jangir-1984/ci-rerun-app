process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
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
  }),
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
    case "today":
      from = new Date();
      from.setHours(0, 0, 0, 0);
      to = now;
      break;

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

    case "last_month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
      to.setHours(23, 59, 59, 999);
      break;

    default:
      return null; // ❌ Invalid or missing filter
  }

  return { from, to };
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
    results: [],
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
    return res.json({ status: 401, error: "Invalid Credentials" });
  }

  // Never send password back
  const { password: _, ...safeUser } = user;

  res.json({ status: 200, data: safeUser });
});

app.put("/user/:id", async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, current, password, pat, result } = req.body;

  const db = loadDB();

  const user = db.users.find((u) => u.id === id);
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (pat) user.pat = encryptPAT(pat, user.id);

  if (current && password) {
    const isValid = await verifyPassword(current, user.password);
    if (!isValid) {
      const { password: _, ...safeUser } = user;
      return res.json({ status: 401, data: safeUser, error: "Current or new password is incorrect" });
    }
    user.password = await hashPassword(password);
  }

  if (result) {
    user.results = result;
  }

  saveDB(db);

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

    const dateRange = getDateRange(range);
    if (!dateRange) {
      return res.json([]);
    }

    if (!project) {
      return res.status(400).json({ error: "project required" });
    }

    const authHeader = {
      Authorization: "Basic " + Buffer.from(`:${decryptPAT(user.pat)}`).toString("base64"),
    };

    const base = `https://dev.azure.com/${process.env.AZURE_ORG}/${project}`;

    // 1. Get builds
    const buildsRes = await axios.get(`${base}/_apis/build/builds?api-version=7.1-preview.7`, { headers: authHeader });

    // ✅ Filter by date range AND success-with-failure result
    const builds = buildsRes.data.value.filter((b) => {
      if (!b.finishTime || !b.result) return false;

      const finish = new Date(b.finishTime);
      const isInRange = finish >= dateRange.from && finish <= dateRange.to;

      const result = b.result.toLowerCase();

      const isSuccessWithFailure = result === "partiallysucceeded";

      return isInRange && isSuccessWithFailure;
    });

    // 2. Enrich builds
    const enriched = await Promise.all(
      builds.map(async (b) => {
        const formatDate = (iso) =>
          `${new Date(iso).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })} ${new Date(iso).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}`;

        try {
          await axios.get(`${base}/_apis/test/runs?buildIds=${b.id}&api-version=7.1-preview.7`, { headers: authHeader });

          return {
            buildId: b.id,
            pipelineName: b.definition?.name,
            result: b.result,
            status: b.status,
            date: formatDate(b.finishTime), // ✅ formatted
          };
        } catch {
          return {
            buildId: b.id,
            pipelineName: b.definition?.name,
            result: b.result,
            status: b.status,
            date: formatDate(b.finishTime), // ✅ formatted
          };
        }
      }),
    );

    res.json({ status: 200, data: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const server = app.listen(3001, () => console.log("✅ Backend running on port 3001"));
server.timeout = 120000;
