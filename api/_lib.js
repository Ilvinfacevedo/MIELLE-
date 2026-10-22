// Shared helpers for the admin API. Files starting with "_" are not exposed as routes by Vercel.
import { createHash, timingSafeEqual } from "node:crypto";

export function config(){
  return {
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO || "Ilvinfacevedo/MIELLE-",
    branch: process.env.GITHUB_BRANCH || "main",
    password: process.env.ADMIN_PASSWORD
  };
}

const hash = s => createHash("sha256").update(String(s)).digest();

export function passwordOk(given){
  const { password } = config();
  if (!password || typeof given !== "string") return false;
  return timingSafeEqual(hash(given), hash(password));
}

// Rejects anything that is not an authenticated POST. Returns true when the request may proceed.
export function guard(req, res){
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return false; }
  const { token, password } = config();
  if (!password || !token) { res.status(500).json({ error: "Faltan ADMIN_PASSWORD o GITHUB_TOKEN en Vercel" }); return false; }
  if (!passwordOk(req.body && req.body.password)) { res.status(401).json({ error: "Contraseña incorrecta" }); return false; }
  return true;
}

export async function gh(path, options = {}){
  const { token, repo } = config();
  const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.message || `GitHub respondió ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return data;
}
