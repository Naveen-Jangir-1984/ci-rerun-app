require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: process.env.SERVER_URL,
    credentials: true,
  })
);
app.use(express.json());

const base = `https://dev.azure.com/${process.env.AZURE_ORG}/${process.env.AZURE_PROJECT}`;
const authHeader = "Basic " + Buffer.from(`:${process.env.AZURE_PAT}`).toString("base64");

app.get("/builds", async (_, res) => {
  const r = await axios.get(`${base}/_apis/build/builds?api-version=7.1-preview.7`, { authHeader });
  res.json(r.data.value);
});

app.post("/download/:buildId", async (req, res) => {
  const { buildId } = req.params;
  const artifactsUrl = base + `/_apis/build/builds/${buildId}/artifacts?api-version=7.1-preview.5`;

  const artifactsRes = await fetch(artifactsUrl, {
    headers: { Authorization: authHeader },
  });

  if (!artifactsRes.ok) {
    throw new Error("Failed to list artifacts");
  }

  const artifacts = await artifactsRes.json();
  const artifact = artifacts.value.find((a) => a.name === "junit-xml");

  if (!artifact) {
    throw new Error(`Artifact "junit-xml" not found`);
  }

  const zipRes = await fetch(artifact.resource.downloadUrl, {
    headers: { Authorization: authHeader },
  });

  if (!zipRes.ok) {
    throw new Error("Failed to download artifact ZIP");
  }

  const buffer = Buffer.from(await zipRes.arrayBuffer());

  const utilitiesDir = path.join(process.cwd(), "../local-runner/Utilities/");
  fs.mkdirSync(utilitiesDir, { recursive: true });

  const zipPath = path.join(utilitiesDir, "junit.zip");
  fs.writeFileSync(zipPath, buffer);

  res.json({ status: "DOWNLOADED" });
});

app.listen(3001, () => console.log("✅ Backend running on port 3001"));
