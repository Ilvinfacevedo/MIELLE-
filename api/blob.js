// POST /api/blob — uploads one product photo (base64 JPEG) to GitHub without committing yet.
import { guard, gh } from "./_lib.js";

const MAX_BASE64 = 3 * 1024 * 1024;

export default async function handler(req, res){
  if (!guard(req, res)) return;
  const content = req.body.content;
  if (typeof content !== "string" || !content.startsWith("/9j/") || content.length > MAX_BASE64) {
    return res.status(400).json({ error: "La foto debe ser JPG y pesar menos de 2 MB" });
  }
  try {
    const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content, encoding: "base64" }) });
    res.status(200).json({ sha: blob.sha });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
