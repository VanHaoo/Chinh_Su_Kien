import express from "express";
import cors from "cors";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";

import fs from "node:fs";

import projectsRouter from "./routes/projects.js";
import uploadRouter from "./routes/upload.js";
import { attachSocket } from "./socket.js";
import "./db.js"; // ensures schema exists before the API starts serving

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/projects", projectsRouter);
app.use("/api/upload", uploadRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const clientDistPath = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (
      req.method === "GET" &&
      !req.path.startsWith("/api") &&
      !req.path.startsWith("/uploads") &&
      !req.path.startsWith("/socket.io")
    ) {
      return res.sendFile(path.join(clientDistPath, "index.html"));
    }
    next();
  });
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});
attachSocket(io);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`LED Controller server listening on http://localhost:${PORT}`);
});
