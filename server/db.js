import initSqlJs from "sql.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, "database");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, "database.sqlite");

const wasmPath = path.join(__dirname, "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm");
const SQL = await initSqlJs({
  locateFile: (file) => (file.endsWith(".wasm") && fs.existsSync(wasmPath) ? wasmPath : file),
});

let dbData = null;
if (fs.existsSync(dbPath)) {
  try {
    dbData = fs.readFileSync(dbPath);
  } catch (e) {
    console.error("Failed to read existing database file:", e);
  }
}

const sqlDb = new SQL.Database(dbData);
let inTransaction = false;

function saveDb() {
  if (inTransaction) return;
  try {
    const data = sqlDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (e) {
    console.error("Failed to save database file:", e);
  }
}

function bindParams(args) {
  if (args.length === 0) return null;
  if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
    if (Array.isArray(args[0])) return args[0];
    const obj = args[0];
    const bound = {};
    for (const [k, v] of Object.entries(obj)) {
      bound[`@${k}`] = v;
      bound[`:${k}`] = v;
      bound[`$${k}`] = v;
    }
    return bound;
  }
  return args;
}

export const db = {
  pragma(sql) {
    try {
      sqlDb.exec(`PRAGMA ${sql};`);
    } catch (e) {
      // ignore unsupported pragmas
    }
  },

  exec(sql) {
    sqlDb.exec(sql);
    saveDb();
  },

  prepare(sql) {
    return {
      get(...args) {
        const stmt = sqlDb.prepare(sql);
        try {
          const bound = bindParams(args);
          if (bound) stmt.bind(bound);
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },

      all(...args) {
        const stmt = sqlDb.prepare(sql);
        const results = [];
        try {
          const bound = bindParams(args);
          if (bound) stmt.bind(bound);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          return results;
        } finally {
          stmt.free();
        }
      },

      run(...args) {
        const stmt = sqlDb.prepare(sql);
        try {
          const bound = bindParams(args);
          if (bound) stmt.bind(bound);
          stmt.step();
          const changes = sqlDb.getRowsModified();
          saveDb();
          return { changes };
        } finally {
          stmt.free();
        }
      },
    };
  },

  transaction(fn) {
    return (...args) => {
      inTransaction = true;
      sqlDb.exec("BEGIN TRANSACTION;");
      try {
        const res = fn(...args);
        sqlDb.exec("COMMIT;");
        inTransaction = false;
        saveDb();
        return res;
      } catch (err) {
        sqlDb.exec("ROLLBACK;");
        inTransaction = false;
        throw err;
      }
    };
  },
};

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Schema matches spec section 14: projects / objects / timeline.
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    width INTEGER NOT NULL DEFAULT 1920,
    height INTEGER NOT NULL DEFAULT 1080,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS objects (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    x REAL NOT NULL DEFAULT 0,
    y REAL NOT NULL DEFAULT 0,
    width REAL NOT NULL DEFAULT 200,
    height REAL NOT NULL DEFAULT 200,
    rotation REAL NOT NULL DEFAULT 0,
    opacity REAL NOT NULL DEFAULT 100,
    z_index INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS timeline (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    duration REAL NOT NULL DEFAULT 300,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_objects_project ON objects(project_id);
`);

export default db;
