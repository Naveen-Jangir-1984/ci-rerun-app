process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { hashPassword, verifyPassword, encryptPAT, decryptPAT } = require("./utils/crypto");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1gb" }));
app.use(express.urlencoded({ limit: "1gb", extended: true }));

const port = 2001;
const DB_PATH = path.join(__dirname, "db", "data.json");

/* ---------------- Configuration ---------- */
const CONFIG = {
  AZURE_TIMEOUT: 60000, // 60 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // Start with 1 second
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_CONCURRENT_REQUESTS: 10,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 50,
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
const loadDB = () => {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
};

const saveDB = (db) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
};

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

  // Cleanup old cache entries (keep max 100 items)
  if (cache.size > 100) {
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

const getDateRange = (range) => {
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
};

/* ---------------- Health ----------------- */
app.get("/health", (_, res) => {
  res.json({ status: "OK" });
});

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
  try {
    const { user } = req.body;

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

    const authHeader = {
      Authorization: "Basic " + Buffer.from(`:${decryptPAT(user.pat)}`).toString("base64"),
    };
    const url = `https://dev.azure.com/${process.env.AZURE_ORG}/_apis/projects?api-version=7.1-preview.4`;

    // Use cache key for projects (user-specific)
    const cacheKey = getCacheKey(url, { userId: user.id });

    const r = await azureApiCall(
      url,
      {
        method: "GET",
        headers: authHeader,
      },
      cacheKey,
    );

    res.json({ status: r.status, data: r.data.value });
  } catch (error) {
    console.error("❌ Error fetching projects:", error.message);

    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return res.status(504).json({
        status: 504,
        error: "Azure API request timed out. Please try again.",
      });
    }

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      error: error.message || "Failed to fetch projects",
    });
  }
});

/* ---------------- Get Builds ------------- */
app.post("/builds", async (req, res) => {
  try {
    const { user } = req.body;
    const { project, range } = req.query;

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

    const dateRange = getDateRange(range);
    if (!dateRange) {
      return res.json({ status: 200, data: [] });
    }

    if (!project) {
      return res.status(400).json({ status: 400, error: "project required" });
    }

    const authHeader = {
      Authorization: "Basic " + Buffer.from(`:${decryptPAT(user.pat)}`).toString("base64"),
    };

    const base = `https://dev.azure.com/${process.env.AZURE_ORG}/${project}`;
    const buildsUrl = `${base}/_apis/build/builds?api-version=7.1-preview.7`;

    // Use cache key for builds
    const cacheKey = getCacheKey(buildsUrl, { project, range });

    // 1. Get builds with retry and caching
    const buildsRes = await azureApiCall(buildsUrl, { method: "GET", headers: authHeader }, cacheKey);

    // ✅ Filter by date range AND success-with-failure result
    const builds = buildsRes.data.value.filter((b) => {
      if (!b.finishTime || !b.result) return false;

      const finish = new Date(b.finishTime);
      const isInRange = finish >= dateRange.from && finish <= dateRange.to;

      const result = b.result.toLowerCase();
      const isSuccessWithFailure = result === "partiallysucceeded";

      return isInRange && isSuccessWithFailure;
    });

    // 2. Enrich builds with controlled concurrency
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

    // Process builds in batches to avoid overwhelming Azure API
    const batchSize = 5;
    const enriched = [];

    for (let i = 0; i < builds.length; i += batchSize) {
      const batch = builds.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (b) => {
          try {
            // Optional test runs check with retry
            await retryWithBackoff(async () => {
              return await axiosInstance.get(`${base}/_apis/test/runs?buildIds=${b.id}&api-version=7.1-preview.7`, { headers: authHeader });
            });
          } catch (error) {
            // Log but don't fail - test runs are optional
            console.log(`⚠️ Could not fetch test runs for build ${b.id}`);
          }

          return {
            buildId: b.id,
            pipelineName: b.definition?.name,
            result: b.result,
            status: b.status,
            date: formatDate(b.finishTime),
          };
        }),
      );

      // Extract successful results
      batchResults.forEach((result) => {
        if (result.status === "fulfilled") {
          enriched.push(result.value);
        }
      });
    }

    res.json({ status: 200, data: enriched });
  } catch (error) {
    console.error("❌ Error fetching builds:", error.message);

    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return res.status(504).json({
        status: 504,
        error: "Azure API request timed out. The server may be slow. Please try again.",
      });
    }

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      error: error.message || "Failed to fetch builds",
    });
  }
});

const server = app.listen(port, () => console.log(`✅ Backend running on port ${port}`));
server.timeout = 120000;
