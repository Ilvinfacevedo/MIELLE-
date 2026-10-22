// POST /api/check — confirms the admin password.
import { guard } from "./_lib.js";

export default function handler(req, res){
  if (!guard(req, res)) return;
  res.status(200).json({ ok: true });
}
