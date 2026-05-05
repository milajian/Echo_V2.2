import express from "express";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

// Match Vite: `.env` then `.env.local` (local overrides)
dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQLiteStore = connectSqlite3(session);
const db = new Database("local.db");

// Initialize Database Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS inspirations (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    type TEXT NOT NULL,
    tags TEXT, -- JSON array
    personId TEXT,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    aiInsight TEXT, -- JSON blob
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    notes TEXT,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    fromId TEXT NOT NULL,
    toId TEXT NOT NULL,
    type TEXT NOT NULL,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (fromId) REFERENCES people(id),
    FOREIGN KEY (toId) REFERENCES people(id)
  );

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS summaries (
    id TEXT PRIMARY KEY,
    weekStart TEXT NOT NULL, -- YYYY-MM-DD
    content TEXT NOT NULL,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS insightReports (
    id TEXT PRIMARY KEY,
    title TEXT,
    summary TEXT,
    report TEXT, -- JSON blob
    sourceIds TEXT, -- JSON array of inspiration ids
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    tags TEXT, -- JSON array
    inspirationId TEXT, -- source inspiration card, if seeded from one
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chatMessages (
    id TEXT PRIMARY KEY,
    conversationId TEXT NOT NULL,
    role TEXT NOT NULL, -- 'user' | 'model'
    content TEXT NOT NULL,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (conversationId) REFERENCES conversations(id)
  );
`);

// Migrations for previously-created databases
try {
  const cols = db.prepare("PRAGMA table_info(inspirations)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "aiInsight")) {
    db.exec("ALTER TABLE inspirations ADD COLUMN aiInsight TEXT");
  }
} catch (err) {
  console.error("Migration check failed:", err);
}

try {
  const cols = db.prepare("PRAGMA table_info(conversations)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "tags")) {
    db.exec("ALTER TABLE conversations ADD COLUMN tags TEXT");
  }
  if (!cols.some((c) => c.name === "inspirationId")) {
    db.exec("ALTER TABLE conversations ADD COLUMN inspirationId TEXT");
  }
} catch (err) {
  console.error("Conversation migration check failed:", err);
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const isProduction = process.env.NODE_ENV === "production";

  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(
    session({
      store: new SQLiteStore({
        db: "sessions.db",
        dir: ".",
      }) as any,
      secret: process.env.SESSION_SECRET || "Echo-local-secret",
      resave: false,
      saveUninitialized: false,
      name: "Echo.sid",
      cookie: {
        // On localhost (HTTP), secure+none cookies are rejected by browsers.
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, 
      },
    })
  );

  app.use((req, res, next) => {
    const session = req.session as any;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - SID: ${req.sessionID} - UID: ${session?.userId || 'None'}`);
    next();
  });

  // --- Auth Routes ---
  app.post("/api/register", (req, res) => {
    const { username, password } = req.body;
    try {
      const id = Math.random().toString(36).substring(2, 15);
      const hashedPassword = bcrypt.hashSync(password, 10);
      const now = Date.now();
      const stmt = db.prepare("INSERT INTO users (id, username, password, createdAt) VALUES (?, ?, ?, ?)");
      stmt.run(id, username, hashedPassword, now);
      
      (req.session as any).userId = id;
      (req.session as any).username = username;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error during registration:", err);
          return res.status(500).json({ error: "Registered but failed to start session" });
        }
        res.json({ success: true, user: { id, username } });
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (user && bcrypt.compareSync(password, user.password)) {
      (req.session as any).userId = user.id;
      (req.session as any).username = user.username;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to save session" });
        }
        res.json({ success: true, user: { id: user.id, username: user.username } });
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/me", (req, res) => {
    if ((req.session as any).userId) {
      res.json({ user: { id: (req.session as any).userId, username: (req.session as any).username } });
    } else {
      res.status(401).json({ error: "Not logged in" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // --- Data Routes ---
  // Midleware to protect data routes
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    next();
  };

  // Inspirations
  app.get("/api/inspirations", requireAuth, (req: any, res) => {
    try {
      const inspirations = db.prepare("SELECT * FROM inspirations WHERE userId = ? ORDER BY createdAt DESC").all(req.session.userId);
      res.json(inspirations.map((i: any) => ({
        ...i,
        tags: i.tags ? JSON.parse(i.tags) : [],
        aiInsight: i.aiInsight ? (() => { try { return JSON.parse(i.aiInsight); } catch { return i.aiInsight; } })() : undefined,
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/inspirations", requireAuth, (req: any, res) => {
    const { content, type, tags, personId } = req.body;
    try {
      const id = Math.random().toString(36).substring(2, 15);
      const now = Date.now();
      const stmt = db.prepare("INSERT INTO inspirations (id, content, type, tags, personId, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      stmt.run(id, content, type, JSON.stringify(tags || []), personId || null, req.session.userId, now, now);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // People
  app.get("/api/people", requireAuth, (req: any, res) => {
    try {
      const people = db.prepare("SELECT * FROM people WHERE userId = ?").all(req.session.userId);
      res.json(people);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/people", requireAuth, (req: any, res) => {
    const { name, category, notes } = req.body;
    try {
      const id = Math.random().toString(36).substring(2, 15);
      const now = Date.now();
      const stmt = db.prepare("INSERT INTO people (id, name, category, notes, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run(id, name, category, notes || '', req.session.userId, now);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Relationships
  app.get("/api/relationships", requireAuth, (req: any, res) => {
    try {
      const relationships = db.prepare("SELECT * FROM relationships WHERE userId = ?").all(req.session.userId);
      res.json(relationships);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/relationships", requireAuth, (req: any, res) => {
    const { fromId, toId, type } = req.body;
    try {
      const id = Math.random().toString(36).substring(2, 15);
      const now = Date.now();
      const stmt = db.prepare("INSERT INTO relationships (id, fromId, toId, type, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run(id, fromId, toId, type, req.session.userId, now);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Goals
  app.get("/api/goals", requireAuth, (req: any, res) => {
    try {
      const goals = db.prepare("SELECT * FROM goals WHERE userId = ?").all(req.session.userId);
      res.json(goals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/goals", requireAuth, (req: any, res) => {
    const { title, description, status } = req.body;
    try {
      const id = Math.random().toString(36).substring(2, 15);
      const now = Date.now();
      const stmt = db.prepare("INSERT INTO goals (id, title, description, status, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)");
      stmt.run(id, title, description || '', status, req.session.userId, now, now);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Summaries
  app.get("/api/summaries", requireAuth, (req: any, res) => {
    try {
      const summaries = db.prepare("SELECT * FROM summaries WHERE userId = ? ORDER BY weekStart DESC").all(req.session.userId);
      res.json(summaries);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/summaries", requireAuth, (req: any, res) => {
    const { weekStart, content } = req.body;
    try {
      const id = Math.random().toString(36).substring(2, 15);
      const now = Date.now();
      const stmt = db.prepare("INSERT INTO summaries (id, weekStart, content, userId, createdAt) VALUES (?, ?, ?, ?, ?)");
      stmt.run(id, weekStart, content, req.session.userId, now);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/insightReports", requireAuth, (req: any, res) => {
    try {
      const rows = db.prepare("SELECT * FROM insightReports WHERE userId = ? ORDER BY createdAt DESC").all(req.session.userId);
      res.json(rows.map((r: any) => ({ ...r, report: r.report ? JSON.parse(r.report) : null, sourceIds: r.sourceIds ? JSON.parse(r.sourceIds) : [] })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/insightReports", requireAuth, (req: any, res) => {
    const { title, summary, report, sourceIds } = req.body;
    try {
      const id = Math.random().toString(36).substring(2, 15);
      const now = Date.now();
      const stmt = db.prepare("INSERT INTO insightReports (id, title, summary, report, sourceIds, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      stmt.run(id, title || null, summary || null, JSON.stringify(report || {}), JSON.stringify(sourceIds || []), req.session.userId, now, now);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Conversations (list, create, rename, delete)
  app.get("/api/conversations", requireAuth, (req: any, res) => {
    try {
      const rows = db.prepare("SELECT * FROM conversations WHERE userId = ? ORDER BY updatedAt DESC").all(req.session.userId) as any[];
      const parsed = rows.map((r) => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] }));
      res.json(parsed);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/conversations", requireAuth, (req: any, res) => {
    const { title, tags, inspirationId } = req.body || {};
    try {
      const id = Math.random().toString(36).substring(2, 15);
      const now = Date.now();
      const tagsJson = Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null;
      const insId = typeof inspirationId === 'string' && inspirationId ? inspirationId : null;
      const stmt = db.prepare("INSERT INTO conversations (id, title, tags, inspirationId, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)");
      stmt.run(id, title || '新对话', tagsJson, insId, req.session.userId, now, now);
      res.json({ success: true, id, title: title || '新对话', tags: Array.isArray(tags) ? tags : [], inspirationId: insId, createdAt: now, updatedAt: now });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/conversations/:id", requireAuth, (req: any, res) => {
    const { id } = req.params;
    const { title } = req.body || {};
    try {
      const now = Date.now();
      const stmt = db.prepare("UPDATE conversations SET title = ?, updatedAt = ? WHERE id = ? AND userId = ?");
      stmt.run(title, now, id, req.session.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/conversations/:id", requireAuth, (req: any, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM chatMessages WHERE conversationId = ? AND userId = ?").run(id, req.session.userId);
      db.prepare("DELETE FROM conversations WHERE id = ? AND userId = ?").run(id, req.session.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Messages within a conversation
  app.get("/api/conversations/:id/messages", requireAuth, (req: any, res) => {
    const { id } = req.params;
    try {
      const owner = db.prepare("SELECT id FROM conversations WHERE id = ? AND userId = ?").get(id, req.session.userId);
      if (!owner) return res.status(404).json({ error: "Conversation not found" });
      const rows = db.prepare("SELECT * FROM chatMessages WHERE conversationId = ? AND userId = ? ORDER BY createdAt ASC").all(id, req.session.userId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/conversations/:id/messages", requireAuth, (req: any, res) => {
    const { id } = req.params;
    const { role, content } = req.body || {};
    if (role !== 'user' && role !== 'model') return res.status(400).json({ error: "Invalid role" });
    if (!content || typeof content !== 'string') return res.status(400).json({ error: "Missing content" });
    try {
      const owner = db.prepare("SELECT id FROM conversations WHERE id = ? AND userId = ?").get(id, req.session.userId);
      if (!owner) return res.status(404).json({ error: "Conversation not found" });
      const msgId = Math.random().toString(36).substring(2, 15);
      const now = Date.now();
      db.prepare("INSERT INTO chatMessages (id, conversationId, role, content, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(msgId, id, role, content, req.session.userId, now);
      db.prepare("UPDATE conversations SET updatedAt = ? WHERE id = ? AND userId = ?").run(now, id, req.session.userId);
      res.json({ success: true, id: msgId, createdAt: now });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Common update/delete for all collections (simplified)
  const collections = ["inspirations", "people", "relationships", "goals", "summaries"];
  const tablesWithUpdateAt = ["inspirations", "goals"];
  // add insightReports collection
  collections.push('insightReports');
  tablesWithUpdateAt.push('insightReports');
  
  collections.forEach(coll => {
    app.put(`/api/${coll}/:id`, requireAuth, (req: any, res) => {
      const { id } = req.params;
      const data = req.body;
      const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'userId' && k !== 'createdAt' && k !== 'updatedAt');
      if (keys.length === 0) return res.json({ success: true });
      
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const values = keys.map(k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
      
      try {
        let result;
        if (tablesWithUpdateAt.includes(coll)) {
          const now = Date.now();
          const stmt = db.prepare(`UPDATE ${coll} SET ${setClause}, updatedAt = ? WHERE id = ? AND userId = ?`);
          result = stmt.run(...values, now, id, req.session.userId);
        } else {
          const stmt = db.prepare(`UPDATE ${coll} SET ${setClause} WHERE id = ? AND userId = ?`);
          result = stmt.run(...values, id, req.session.userId);
        }
        if (result && (result as any).changes === 0) {
          return res.status(404).json({ error: `${coll} record not found or not owned by user` });
        }
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.delete(`/api/${coll}/:id`, requireAuth, (req: any, res) => {
      const { id } = req.params;
      try {
        const stmt = db.prepare(`DELETE FROM ${coll} WHERE id = ? AND userId = ?`);
        stmt.run(id, req.session.userId);
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  });

  // Vite middleware for development
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
