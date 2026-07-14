/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { apiRouter } from "./src/backend/api";
import { db } from "./src/shared/database/db";

// Ensure environment variables are loaded
dotenv.config();

async function startServer() {
  // Initialize Database Pool (and load state from cloud DB if configured)
  await db.initialize();

  const app = express();
  // Render (and most PaaS hosts) inject the port to listen on via $PORT.
  // Falling back to 3000 keeps local development unchanged.
  const PORT = Number(process.env.PORT) || 3000;

  // Enable CORS natively via middleware headers.
  //
  // For a split deployment (frontend on Vercel, backend on Render) the browser
  // makes cross-origin requests, so the backend must send the right CORS
  // headers back. Set ALLOWED_ORIGINS to a comma-separated list of the exact
  // frontend origins (e.g. "https://my-store.vercel.app,https://www.mydomain.com").
  // If ALLOWED_ORIGINS is unset we allow any origin ("*"), which is fine here
  // because the API is token-based and never relies on cookies/credentials.
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin as string | undefined;

    if (allowedOrigins.length === 0) {
      res.header("Access-Control-Allow-Origin", "*");
    } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      res.header("Access-Control-Allow-Origin", requestOrigin);
      res.header("Vary", "Origin");
    } else {
      res.header("Access-Control-Allow-Origin", allowedOrigins[0]);
      res.header("Vary", "Origin");
    }

    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-Store-Id, X-Store-Slug, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Configure JSON and URL-encoded body parsers
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Mount CoreCart Engine API Routes
  app.use("/api/v1", apiRouter);

  // Setup Health Check endpoints
  app.get("/health/liveness", (req, res) => {
    res.status(200).json({ status: "alive" });
  });

  app.get("/health/readiness", (req, res) => {
    res.status(200).json({ status: "ready" });
  });

  // Vite integration based on environment
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Let Vite handle frontend static routing and asset compilation
    app.use(vite.middlewares);
  } else {
    // Serve static frontend assets from standard compiled dist/ directory
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CoreCart Multi-Tenant Engine running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start CoreCart server:", err);
  process.exit(1);
});
