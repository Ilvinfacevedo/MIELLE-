// Mielle admin: edit products and shipping settings, then save them to GitHub through /api.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => Number(n).toLocaleString("en-US");
const money = n => "RD$" + fmt(n);
const clone = v => JSON.parse(JSON.stringify(v));
const photoURL = p => p._newPhoto || (p.photo ? (/^(https?:|data:|\/)/.test(p.photo) ? p.photo : "/" + p.photo) : "");

let password = "";
let original = null, draft = null, draftSettings = null;
let editing = null, formPhoto = "", formPhotoIsNew = false, dirty = false, tab = "products";

function setStatus(msg, err){ $("status").textContent = msg; $("status").classList.toggle("err", !!err); }
function markDirty(){ dirty = true; $("publishBtn").disabled = false; setStatus("Tienes cambios sin guardar."); }

async function api(path, body){
  const r = await fetch(path, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(Object.assign({password}, body || {}))});
  let data = {};
  try { data = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error(data.error || "Error " + r.status); err.status = r.status; throw err; }
  return data;
}

/* ---------- Login ---------- */
try { password = sessionStorage.getItem("mielle-admin") || ""; } catch (e) {}

$("login").addEventListener("submit", async e => {
  e.preventDefault();
  password = $("pass").value;
  $("loginBtn").disabled = true; $("loginStatus").textContent = "Verificando…"; $("loginStatus").classList.remove("err");
  try {
    await api("/api/check");
    try { sessionStorage.setItem("mielle-admin", password); } catch (e) {}
    await start();
  } catch (err) {
    $("loginStatus").textContent = err.status === 401 ? "Contraseña incorrecta." : "No se pudo conectar. Revisa la configuración en Vercel.";
    $("loginStatus").classList.add("err");
  }
  $("loginBtn").disabled = false;
});

async function start(){
  const r = await fetch("/products.json", {cache: "no-store"});
  const data = await r.json();
  original = {products: data.products || [], settings: data.settings || {}};
  draft = clone(original.products);
  draftSettings = Object.assign({whatsapp: "", shipping: [], payments: [], bank: ""}, clone(original.settings));
  $("login").hidden = true; $("adminPage").hidden = false;
  dirty = false; $("publishBtn").disabled = true;
  setTab("products"); renderAdminList(); renderSettings();
  setStatus(draftSettings.whatsapp ? "Agrega, edita u ordena productos. Luego toca \"Guardar cambios\"." : "Falta tu número de WhatsApp. Ponlo en \"Pedidos y envíos\".", !draftSettings.whatsapp);
}

if (password) {
  api("/api/check").then(start).catch(() => { password = ""; try { sessionStorage.removeItem("mielle-admin"); } catch (e) {} });
}

window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- Product list ---------- */
function drawing(p){ return `<svg viewBox="0 0 60 100" aria-hidden="true"><use href="#i-${esc(p.icon || "bottle")}"/></svg>`; }

function renderAdminList(){
  if (!draft.length) { $("adminList").innerHTML = `<li class="empty">Aún no hay productos. Toca "Nuevo producto".</li>`; return; }
  $("adminList").innerHTML = draft.map((p, i) => `<li class="arow" data-i="${i}">
    <div class="thumb">${photoURL(p) ? `<img src="${esc(photoURL(p))}" alt="">` : drawing(p)}</div>
    <div class="info"><b>${esc(p.name)}</b><span>${esc(p.brand)} · ${p.price ? money(p.price) : "Precio por DM"}${p.sold ? " · Agotado" : ""}</span></div>
    <div class="acts">
      <button class="icon-btn" type="button" data-act="up" aria-label="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
      <button class="icon-btn" type="button" data-act="down" aria-label="Bajar" ${i === draft.length - 1 ? "disabled" : ""}>↓</button>
      <button class="btn ghost sm" type="button" data-act="edit">Editar</button>
      <button class="btn danger sm" type="button" data-act="del">Borrar</button>
    </div>
  </li>`).join("");
}
$("adminList").addEventListener("click", e => {
  const btn = e.target.closest("button[data-act]"); if (!btn) return;
  const i = Number(btn.closest("li").dataset.i), act = btn.dataset.act;
  if (act === "up" && i > 0) { [draft[i-1], draft[i]] = [draft[i], draft[i-1]]; markDirty(); renderAdminList(); }
  else if (act === "down" && i < draft.length - 1) { [draft[i+1], draft[i]] = [draft[i], draft[i+1]]; markDirty(); renderAdminList(); }
  else if (act === "edit") openForm(i);
  else if (act === "del") {
    if (!btn.classList.contains("armed")) { btn.classList.add("armed"); btn.textContent = "¿Seguro?"; return; }
    draft.splice(i, 1); markDirty(); renderAdminList();
  }
});

/* ---------- Settings ---------- */
function shipRow(s){
  const row = document.createElement("div"); row.className = "ship-row"; row.dataset.id = s.id;
  row.innerHTML = `<div class="r1"><input type="text" data-k="name" placeholder="Nombre" aria-label="Nombre del envío" value="${esc(s.name)}"><input type="number" data-k="cost" inputmode="numeric" min="0" placeholder="Costo" aria-label="Costo en RD$" value="${s.cost == null ? "" : esc(s.cost)}"><button class="icon-btn" type="button" aria-label="Quitar">×</button></div>
    <input type="text" data-k="note" placeholder="Nota para el cliente" aria-label="Nota" value="${esc(s.note)}">
    <label class="check"><input type="checkbox" data-k="branch" ${s.branch ? "checked" : ""}> Pedir sucursal de retiro</label>`;
  row.querySelector("button").onclick = () => { row.remove(); readSettings(); markDirty(); };
  $("shipList").appendChild(row);
}
function renderSettings(){
  $("sWa").value = draftSettings.whatsapp || "";
  $("sPay").value = (draftSettings.payments || []).join("\n");
  $("sBank").value = draftSettings.bank || "";
  $("shipList").innerHTML = ""; (draftSettings.shipping || []).forEach(shipRow);
}
function readSettings(){
  draftSettings.whatsapp = $("sWa").value.trim();
  draftSettings.payments = $("sPay").value.split("\n").map(s => s.trim()).filter(Boolean);
  draftSettings.bank = $("sBank").value.trim();
  draftSettings.shipping = [...$("shipList").querySelectorAll(".ship-row")].map(r => {
    const raw = r.querySelector('[data-k="cost"]').value.replace(/[^\d]/g, "");
    return {id: r.dataset.id, name: r.querySelector('[data-k="name"]').value.trim(), cost: raw === "" ? null : Number(raw),
      note: r.querySelector('[data-k="note"]').value.trim(), branch: r.querySelector('[data-k="branch"]').checked};
  }).filter(s => s.name);
}
$("settingsView").addEventListener("input", () => { readSettings(); markDirty(); });
$("addShip").onclick = () => { shipRow({id: "s" + Date.now().toString(36), name: "", cost: null, note: "", branch: false}); };

function setTab(t){
  tab = t;
  $("tabProducts").setAttribute("aria-pressed", t === "products");
  $("tabSettings").setAttribute("aria-pressed", t === "settings");
  $("pform").hidden = true;
  $("listView").hidden = t !== "products";
  $("settingsView").hidden = t !== "settings";
  $("newProduct").hidden = t !== "products";
  $("listFoot").hidden = false;
}
$("tabProducts").onclick = () => setTab("products");
$("tabSettings").onclick = () => setTab("settings");

/* ---------- Product form ---------- */
function toneRow(name, color){
  const row = document.createElement("div"); row.className = "tone-row";
  row.innerHTML = `<input type="text" placeholder="Nombre del tono" value="${esc(name)}" aria-label="Nombre del tono"><input type="color" value="${esc(color || "#d98a95")}" aria-label="Color del tono"><button class="icon-btn" type="button" aria-label="Quitar tono">×</button>`;
  row.querySelector("button").onclick = () => row.remove();
  $("toneList").appendChild(row);
}
function setPhotoPreview(src, isNew){
  formPhoto = src || ""; formPhotoIsNew = !!isNew && !!src;
  $("photoPrev").innerHTML = formPhoto ? `<img src="${esc(formPhoto)}" alt="Vista previa">` : "Sin foto";
  $("removePhoto").hidden = !formPhoto;
}
function openForm(i){
  editing = i;
  const p = i == null ? {brand:"",name:"",kind:"",cat:"maquillaje",price:null,desc:"",tones:[],photo:"",sold:false} : draft[i];
  $("formTitle").textContent = i == null ? "Nuevo producto" : "Editar producto";
  $("fBrand").value = p.brand || ""; $("fName").value = p.name || ""; $("fKind").value = p.kind || "";
  $("fPrice").value = p.price ?? ""; $("fCat").value = p.cat || "maquillaje"; $("fDesc").value = p.desc || "";
  $("fSold").checked = !!p.sold; $("fPhoto").value = "";
  $("toneList").innerHTML = ""; (p.tones || []).forEach(([n,c]) => toneRow(n, c));
  setPhotoPreview(photoURL(p), !!p._newPhoto);
  $("listView").hidden = true; $("settingsView").hidden = true; $("listFoot").hidden = true; $("pform").hidden = false;
  setStatus(""); window.scrollTo({top: 0});
}
function loadImage(file){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("bad image")); };
    img.src = url;
  });
}
async function shrink(file){
  const img = await loadImage(file);
  const max = 1000, scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}
$("fPhoto").addEventListener("change", async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  setStatus("Preparando la foto…");
  try { setPhotoPreview(await shrink(f), true); setStatus(""); }
  catch (err) { setStatus("No pude abrir esa foto. Prueba con una JPG o PNG.", true); }
});
$("removePhoto").onclick = () => { setPhotoPreview("", false); $("fPhoto").value = ""; };
$("addTone").onclick = () => toneRow("", "");
$("cancelForm").onclick = () => { setTab("products"); setStatus(dirty ? "Tienes cambios sin guardar." : ""); };
$("pform").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("fName").value.trim();
  if (!name) { setStatus("Escribe el nombre del producto.", true); $("fName").focus(); return; }
  const raw = String($("fPrice").value).replace(/[^\d]/g, "");
  const tones = [...$("toneList").querySelectorAll(".tone-row")]
    .map(r => [r.querySelector("input[type=text]").value.trim(), r.querySelector("input[type=color]").value])
    .filter(t => t[0]);
  const base = editing == null ? {id: "p" + Date.now().toString(36), icon: "bottle", photo: ""} : draft[editing];
  const p = Object.assign({}, base, {
    brand: $("fBrand").value.trim(), name, kind: $("fKind").value.trim(),
    cat: $("fCat").value, price: raw ? Number(raw) : null, desc: $("fDesc").value.trim(),
    tones, sold: $("fSold").checked
  });
  if (formPhotoIsNew) p._newPhoto = formPhoto;
  else { delete p._newPhoto; if (!formPhoto) p.photo = ""; }
  if (editing == null) draft.unshift(p); else draft[editing] = p;
  setTab("products"); renderAdminList(); markDirty();
  setStatus(`"${name}" listo. Toca "Guardar cambios" para que se vea en la tienda.`);
});
$("newProduct").onclick = () => openForm(null);

/* ---------- Save to GitHub ---------- */
$("publishBtn").onclick = async () => {
  if (tab === "settings") readSettings();
  $("publishBtn").disabled = true;
  try {
    const files = [];
    const out = clone(draft); // photos only move to draft once the save succeeds
    const pending = out.filter(p => p._newPhoto);
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      setStatus(`Subiendo fotos… ${i + 1} de ${pending.length}`);
      const {sha} = await api("/api/blob", {content: p._newPhoto.split(",")[1]});
      const path = `img/${p.id}-${Date.now().toString(36)}.jpg`;
      files.push({path, sha});
      p.photo = path; delete p._newPhoto;
    }
    const keep = new Set(out.map(p => p.photo).filter(Boolean));
    const deletes = original.products.map(p => p.photo).filter(ph => ph && ph.startsWith("img/") && !keep.has(ph));
    setStatus("Guardando…");
    await api("/api/save", {data: {products: out, settings: draftSettings}, files, deletes});
    draft = out;
    original = {products: clone(out), settings: clone(draftSettings)};
    dirty = false;
    renderAdminList();
    setStatus("¡Guardado! La tienda se actualiza en 1 minuto más o menos.");
  } catch (err) {
    if (err.status === 401) setStatus("Tu sesión expiró. Recarga la página y vuelve a entrar.", true);
    else if (err.status === 409) setStatus("Hubo otro guardado al mismo tiempo. Toca \"Guardar cambios\" otra vez.", true);
    else setStatus("No se pudo guardar: " + err.message, true);
    $("publishBtn").disabled = false;
  }
};
