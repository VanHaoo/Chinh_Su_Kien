import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db.js";

const router = Router();
const now = () => new Date().toISOString();

function rowToObject(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    opacity: row.opacity,
    zIndex: row.z_index,
    visible: !!row.visible,
    content: JSON.parse(row.content || "{}"),
  };
}

function loadProject(id) {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project) return null;
  const objects = db
    .prepare("SELECT * FROM objects WHERE project_id = ? ORDER BY z_index ASC")
    .all(id)
    .map(rowToObject);
  const timeline = db.prepare("SELECT * FROM timeline WHERE project_id = ?").get(id);
  return {
    id: project.id,
    name: project.name,
    width: project.width,
    height: project.height,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    duration: timeline?.duration ?? 300,
    objects,
  };
}

const replaceObjects = db.transaction((projectId, objects) => {
  db.prepare("DELETE FROM objects WHERE project_id = ?").run(projectId);
  const insert = db.prepare(`
    INSERT INTO objects
      (id, project_id, type, name, x, y, width, height, rotation, opacity, z_index, visible, content, created_at, updated_at)
    VALUES
      (@id, @project_id, @type, @name, @x, @y, @width, @height, @rotation, @opacity, @z_index, @visible, @content, @created_at, @updated_at)
  `);
  const ts = now();
  for (const obj of objects) {
    insert.run({
      id: obj.id || nanoid(10),
      project_id: projectId,
      type: obj.type,
      name: obj.name || obj.type,
      x: obj.x ?? 0,
      y: obj.y ?? 0,
      width: obj.width ?? 200,
      height: obj.height ?? 200,
      rotation: obj.rotation ?? 0,
      opacity: obj.opacity ?? 100,
      z_index: obj.zIndex ?? 0,
      visible: obj.visible === false ? 0 : 1,
      content: JSON.stringify(obj.content ?? {}),
      created_at: ts,
      updated_at: ts,
    });
  }
});

// GET /api/projects — list for the Open Project dialog
router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT id, name, width, height, created_at, updated_at FROM projects ORDER BY updated_at DESC")
    .all();
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      width: r.width,
      height: r.height,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  );
});

// POST /api/projects — New Project
router.post("/", (req, res) => {
  const { name = "Untitled Project", width = 1920, height = 1080 } = req.body || {};
  const id = nanoid(10);
  const ts = now();
  db.prepare(
    "INSERT INTO projects (id, name, width, height, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, name, width, height, ts, ts);
  db.prepare("INSERT INTO timeline (project_id, duration, updated_at) VALUES (?, ?, ?)").run(
    id,
    300,
    ts
  );
  res.status(201).json(loadProject(id));
});

// GET /api/projects/:id — Open Project
router.get("/:id", (req, res) => {
  const project = loadProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });
  res.json(project);
});

// PUT /api/projects/:id — Save Project (meta + full object replace)
router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT id FROM projects WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Project not found" });

  const { name, width, height, objects = [], duration } = req.body || {};
  const ts = now();
  db.prepare(
    "UPDATE projects SET name = COALESCE(?, name), width = COALESCE(?, width), height = COALESCE(?, height), updated_at = ? WHERE id = ?"
  ).run(name ?? null, width ?? null, height ?? null, ts, req.params.id);

  if (duration !== undefined) {
    db.prepare(
      "INSERT INTO timeline (project_id, duration, updated_at) VALUES (?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET duration = excluded.duration, updated_at = excluded.updated_at"
    ).run(req.params.id, duration, ts);
  }

  replaceObjects(req.params.id, objects);
  res.json(loadProject(req.params.id));
});

// PUT /api/projects/:id/rename — Rename Project
router.put("/:id/rename", (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });
  const result = db
    .prepare("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?")
    .run(name.trim(), now(), req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Project not found" });
  res.json(loadProject(req.params.id));
});

// POST /api/projects/:id/save-as — Save As (clone into a new project)
router.post("/:id/save-as", (req, res) => {
  const source = loadProject(req.params.id);
  if (!source) return res.status(404).json({ error: "Project not found" });

  const { name } = req.body || {};
  const id = nanoid(10);
  const ts = now();
  db.prepare(
    "INSERT INTO projects (id, name, width, height, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, name?.trim() || `${source.name} copy`, source.width, source.height, ts, ts);
  db.prepare("INSERT INTO timeline (project_id, duration, updated_at) VALUES (?, ?, ?)").run(
    id,
    source.duration,
    ts
  );
  replaceObjects(id, source.objects);
  res.status(201).json(loadProject(id));
});

// DELETE /api/projects/:id — Delete Project
router.delete("/:id", (req, res) => {
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Project not found" });
  res.status(204).end();
});

export default router;
