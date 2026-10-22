// POST /api/save — commits products.json plus new and removed photos in one commit.
// Vercel redeploys the store automatically when the commit lands.
import { guard, gh, config } from "./_lib.js";

const IMG_PATH = /^img\/[\w.-]+\.jpg$/;
const SHA = /^[0-9a-f]{40}$/;

function valid(body){
  const d = body.data;
  if (!d || !Array.isArray(d.products) || typeof d.settings !== "object" || d.settings === null) return "Datos inválidos";
  if (d.products.some(p => !p || typeof p.id !== "string" || typeof p.name !== "string")) return "Hay un producto sin nombre";
  if (d.products.some(p => p.photo && !IMG_PATH.test(p.photo))) return "Ruta de foto inválida";
  const files = body.files || [], deletes = body.deletes || [];
  if (!Array.isArray(files) || files.some(f => !f || !IMG_PATH.test(f.path) || !SHA.test(f.sha))) return "Fotos inválidas";
  if (!Array.isArray(deletes) || deletes.some(p => !IMG_PATH.test(p))) return "Fotos a borrar inválidas";
  return null;
}

export default async function handler(req, res){
  if (!guard(req, res)) return;
  const problem = valid(req.body);
  if (problem) return res.status(400).json({ error: problem });

  const { branch } = config();
  const { data, files = [], deletes = [] } = req.body;
  try {
    const ref = await gh(`/git/ref/heads/${branch}`);
    const head = await gh(`/git/commits/${ref.object.sha}`);
    const json = JSON.stringify({ products: data.products, settings: data.settings }, null, 2) + "\n";
    const jsonBlob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: json, encoding: "utf-8" }) });

    const tree = [
      { path: "products.json", mode: "100644", type: "blob", sha: jsonBlob.sha },
      ...files.map(f => ({ path: f.path, mode: "100644", type: "blob", sha: f.sha })),
      ...deletes.filter(p => !files.some(f => f.path === p)).map(p => ({ path: p, mode: "100644", type: "blob", sha: null }))
    ];
    const newTree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
    const commit = await gh("/git/commits", {
      method: "POST",
      body: JSON.stringify({ message: "Actualizar productos desde el panel", tree: newTree.sha, parents: [head.sha] })
    });
    await gh(`/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
    res.status(200).json({ ok: true, commit: commit.sha });
  } catch (e) {
    // 422 on the ref update means someone else committed first.
    res.status(e.status === 422 ? 409 : 502).json({ error: e.message });
  }
}
