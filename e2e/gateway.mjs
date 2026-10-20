// Minimal-Gateway für E2E: /auth/v1 -> GoTrue, /rest/v1 -> PostgREST, /storage/v1 -> Mock
// Der Storage-Mock prüft Zugriffe gegen storage.objects MIT RLS als der anfragende Nutzer.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const SECRET = process.env.JWT_SECRET;
const DIR = process.env.STORAGE_DIR;
const pool = new pg.Pool({ connectionString: process.env.DB_URL });

function verify(token) {
  const [h, p, s] = token.split(".");
  const sig = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  if (sig !== s) throw new Error("bad jwt");
  return JSON.parse(Buffer.from(p, "base64url").toString());
}

async function alsNutzer(req, fn) {
  const auth = req.headers.authorization?.replace(/^Bearer /, "") ?? req.headers.apikey;
  const claims = verify(auth);
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${claims.role === "service_role" ? "service_role" : claims.role === "authenticated" ? "authenticated" : "anon"}`);
    await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub ?? ""]);
    const r = await fn(c, claims);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

function body(req) {
  return new Promise((ok) => { const b = []; req.on("data", (d) => b.push(d)); req.on("end", () => ok(Buffer.concat(b))); });
}

const signiert = new Map();

async function storage(req, res, p) {
  const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  try {
    let m;
    if (req.method === "POST" && (m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) {
      const [, bucket, name] = m;
      const n = decodeURIComponent(name);
      const ok = await alsNutzer(req, (c) => c.query("select 1 from storage.objects where bucket_id=$1 and name=$2", [bucket, n]));
      if (!ok.rowCount) return send(400, { statusCode: "404", error: "not_found", message: "Object not found" });
      const t = crypto.randomBytes(16).toString("hex");
      signiert.set(t, { bucket, name: n });
      return send(200, { signedURL: `/object/sign/${bucket}/${name}?token=${t}` });
    }
    if (req.method === "GET" && (m = p.match(/^\/object\/sign\/([^/]+)\/(.+?)(\?.*)?$/))) {
      const u = new URL("http://x" + p);
      const s = signiert.get(u.searchParams.get("token"));
      if (!s) return send(400, { message: "invalid token" });
      const file = path.join(DIR, s.bucket, s.name);
      const dl = u.searchParams.get("download");
      res.writeHead(200, { "content-type": "application/pdf", ...(dl ? { "content-disposition": `attachment; filename="${dl}"` } : {}) });
      return res.end(fs.readFileSync(file));
    }
    if (req.method === "POST" && (m = p.match(/^\/object\/([^/]+)\/(.+)$/))) {
      const [, bucket, name] = m;
      const n = decodeURIComponent(name);
      const data = await body(req);
      await alsNutzer(req, (c, claims) => c.query("insert into storage.objects (bucket_id, name, owner) values ($1,$2,$3)", [bucket, n, claims.sub ?? null]));
      fs.mkdirSync(path.dirname(path.join(DIR, bucket, n)), { recursive: true });
      fs.writeFileSync(path.join(DIR, bucket, n), data);
      return send(200, { Key: `${bucket}/${n}` });
    }
    if (req.method === "GET" && (m = p.match(/^\/object\/(?:authenticated\/)?([^/]+)\/(.+)$/))) {
      const [, bucket, name] = m;
      const n = decodeURIComponent(name.split("?")[0]);
      const ok = await alsNutzer(req, (c) => c.query("select 1 from storage.objects where bucket_id=$1 and name=$2", [bucket, n]));
      if (!ok.rowCount) return send(400, { statusCode: "404", error: "not_found", message: "Object not found" });
      res.writeHead(200, { "content-type": "application/pdf" });
      return res.end(fs.readFileSync(path.join(DIR, bucket, n)));
    }
    send(404, { message: "mock: unbekannt " + req.method + " " + p });
  } catch (e) {
    console.error("storage", e.message);
    send(400, { statusCode: "403", error: "Unauthorized", message: e.message });
  }
}

function proxy(req, res, port, p) {
  const r = http.request({ host: "127.0.0.1", port, path: p, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${port}` } }, (pr) => {
    res.writeHead(pr.statusCode, pr.headers);
    pr.pipe(res);
  });
  r.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(r);
}

http.createServer((req, res) => {
  const u = req.url;
  if (u.startsWith("/auth/v1")) return proxy(req, res, 9999, u.slice(8) || "/");
  if (u.startsWith("/rest/v1")) return proxy(req, res, 3001, u.slice(8) || "/");
  if (u.startsWith("/storage/v1")) return storage(req, res, u.slice(11));
  res.writeHead(404); res.end();
}).listen(54321, "127.0.0.1", () => console.log("gateway :54321"));
