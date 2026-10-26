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
const hasStock = p => p.stock !== undefined && p.stock !== null && p.stock !== "";
const heroURL = s => s._newHeroPhoto || (s.heroPhoto ? "/" + s.heroPhoto : "");

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
  draftSettings = Object.assign({whatsapp: "", shipping: [], payments: [], bank: "", announcement: "🚚 Enviamos a toda República Dominicana"}, clone(original.settings));
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
    <div class="info"><b>${Array.isArray(p.kit) ? "Kit · " : ""}${esc(p.name)}</b><span>${Array.isArray(p.kit) ? p.kit.length + " productos" : esc(p.brand)} · ${p.price ? money(p.price) : "Precio por DM"}${hasStock(p) ? " · Quedan " + p.stock : ""}${p.badge === "top" || (!p.badge && p.featured) ? " · ★ Más vendido" : p.badge === "nuevo" ? " · Nuevo" : ""}${p.sold || (hasStock(p) && Number(p.stock) <= 0) ? " · Agotado" : ""}</span></div>
    <div class="acts">
      <button class="icon-btn" type="button" data-act="top" aria-label="Poner de primero" title="Poner de primero" ${i === 0 ? "disabled" : ""}>⤒</button>
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
  if (act === "top" && i > 0) { draft.unshift(draft.splice(i, 1)[0]); markDirty(); renderAdminList(); }
  else if (act === "up" && i > 0) { [draft[i-1], draft[i]] = [draft[i], draft[i-1]]; markDirty(); renderAdminList(); }
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
function setHeroPreview(){
  const src = heroURL(draftSettings);
  $("heroPrev").innerHTML = src ? `<img src="${esc(src)}" alt="Foto de portada">` : "Sin foto";
  $("removeHero").hidden = !src;
}
function fillHeroProducts(){
  $("sHeroProduct").innerHTML = `<option value="">Automático (el más reciente)</option>` +
    draft.map(p => `<option value="${esc(p.id)}">${esc(p.brand ? p.brand + " · " : "")}${esc(p.name)}</option>`).join("");
  $("sHeroProduct").value = draft.some(p => p.id === draftSettings.heroProduct) ? draftSettings.heroProduct : "";
}
function renderSettings(){
  $("sAnnounce").value = draftSettings.announcement ?? "";
  fillHeroProducts();
  $("sFree").value = draftSettings.freeShipFrom ?? "";
  $("sLow").value = draftSettings.lowStockAt ?? 3;
  $("sHeroTitle").value = draftSettings.heroTitle || "";
  $("sHeroText").value = draftSettings.heroText || "";
  setHeroPreview();
  $("sWa").value = draftSettings.whatsapp || "";
  $("sPay").value = (draftSettings.payments || []).join("\n");
  $("sBank").value = draftSettings.bank || "";
  $("shipList").innerHTML = ""; (draftSettings.shipping || []).forEach(shipRow);
}
function readSettings(){
  draftSettings.announcement = $("sAnnounce").value.trim();
  draftSettings.heroProduct = $("sHeroProduct").value;
  const free = $("sFree").value.replace(/[^\d]/g, ""), low = $("sLow").value.replace(/[^\d]/g, "");
  draftSettings.freeShipFrom = free ? Number(free) : null;
  draftSettings.lowStockAt = low ? Number(low) : 3;
  draftSettings.heroTitle = $("sHeroTitle").value.trim();
  draftSettings.heroText = $("sHeroText").value.trim();
  draftSettings.whatsapp = $("sWa").value.trim();
  draftSettings.payments = $("sPay").value.split("\n").map(s => s.trim()).filter(Boolean);
  draftSettings.bank = $("sBank").value.trim();
  draftSettings.shipping = [...$("shipList").querySelectorAll(".ship-row")].map(r => {
    const raw = r.querySelector('[data-k="cost"]').value.replace(/[^\d]/g, "");
    return {id: r.dataset.id, name: r.querySelector('[data-k="name"]').value.trim(), cost: raw === "" ? null : Number(raw),
      note: r.querySelector('[data-k="note"]').value.trim(), branch: r.querySelector('[data-k="branch"]').checked};
  }).filter(s => s.name);
}
$("settingsView").addEventListener("change", e => { if (e.target.tagName === "SELECT") { readSettings(); markDirty(); } });
$("settingsView").addEventListener("input", e => { if (e.target.type === "file") return; readSettings(); markDirty(); });
$("sHeroPhoto").addEventListener("change", async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  setStatus("Preparando la foto…");
  try { draftSettings._newHeroPhoto = await shrink(f, 1600); setHeroPreview(); markDirty(); }
  catch (err) { setStatus("No pude abrir esa foto. Prueba con una JPG o PNG.", true); }
  e.target.value = "";
});
$("removeHero").onclick = () => { delete draftSettings._newHeroPhoto; draftSettings.heroPhoto = ""; setHeroPreview(); markDirty(); };
$("addShip").onclick = () => { shipRow({id: "s" + Date.now().toString(36), name: "", cost: null, note: "", branch: false}); };

function setTab(t){
  tab = t;
  $("tabProducts").setAttribute("aria-pressed", t === "products");
  $("tabSettings").setAttribute("aria-pressed", t === "settings");
  $("tabSale").setAttribute("aria-pressed", t === "sale");
  $("saleView").hidden = t !== "sale";
  $("tabReviews").setAttribute("aria-pressed", t === "reviews");
  $("reviewView").hidden = t !== "reviews";
  $("tabPromos").setAttribute("aria-pressed", t === "promos");
  $("promoView").hidden = t !== "promos";
  $("pform").hidden = true;
  $("listView").hidden = t !== "products";
  $("settingsView").hidden = t !== "settings";
  $("newProduct").hidden = t !== "products";
  $("newKit").hidden = t !== "products";
  $("listFoot").hidden = t === "sale";
}
$("tabProducts").onclick = () => setTab("products");
$("tabSale").onclick = () => { setTab("sale"); setStatus(""); };
$("tabPromos").onclick = () => { renderPromos(); setTab("promos"); };
$("tabReviews").onclick = () => { fillReviewProducts(); renderReviews(); setTab("reviews"); };
$("tabSettings").onclick = () => { fillHeroProducts(); setTab("settings"); };

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
let formIsKit = false;
function openForm(i, asKit){
  editing = i;
  const p = i == null
    ? (asKit ? {brand:"Mielle",name:"",kind:"Kit",cat:"kits",price:null,desc:"",tones:[],photo:"",sold:false,kit:[]} : {brand:"",name:"",kind:"",cat:"maquillaje",price:null,desc:"",tones:[],photo:"",sold:false})
    : draft[i];
  formIsKit = Array.isArray(p.kit);
  $("formTitle").textContent = i == null ? (formIsKit ? "Nuevo kit" : "Nuevo producto") : (formIsKit ? "Editar kit" : "Editar producto");
  $("kitField").hidden = !formIsKit; $("toneField").hidden = formIsKit; $("stockField").hidden = formIsKit;
  $("kitRows").innerHTML = "";
  if (formIsKit) { (p.kit.length ? p.kit : [{id: "", qty: 1}, {id: "", qty: 1}]).forEach(k => kitRow(k.id, k.qty)); updateKitSum(); }
  $("fBrand").value = p.brand || ""; $("fName").value = p.name || ""; $("fKind").value = p.kind || "";
  $("fPrice").value = p.price ?? ""; $("fCat").value = p.cat || "maquillaje"; $("fDesc").value = p.desc || "";
  $("fSold").checked = !!p.sold; $("fBadge").value = p.badge || (p.featured ? "top" : ""); $("fStock").value = hasStock(p) ? p.stock : ""; $("fHow").value = p.howto || ""; $("fPhoto").value = "";
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
async function shrink(file, max = 1000){
  const img = await loadImage(file);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
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
  const kit = formIsKit ? readKit() : null;
  if (formIsKit && kit.reduce((s, k) => s + k.qty, 0) < 2) { setStatus("Un kit necesita al menos 2 productos.", true); return; }
  if (formIsKit && !raw) { setStatus("Escribe el precio del kit.", true); $("fPrice").focus(); return; }
  const base = editing == null ? {id: "p" + Date.now().toString(36), icon: "jar", photo: "", createdAt: Date.now()} : draft[editing];
  const stockRaw = String($("fStock").value).replace(/[^\d]/g, "");
  const p = Object.assign({}, base, {
    brand: $("fBrand").value.trim(), name, kind: $("fKind").value.trim(),
    cat: $("fCat").value, price: raw ? Number(raw) : null, desc: $("fDesc").value.trim(),
    tones, sold: $("fSold").checked, badge: $("fBadge").value, howto: $("fHow").value.trim(),
    stock: stockRaw === "" ? null : Number(stockRaw)
  });
  delete p.featured;
  if (formIsKit) { p.kit = kit; p.tones = []; p.stock = null; } else delete p.kit;
  if (formPhotoIsNew) p._newPhoto = formPhoto;
  else { delete p._newPhoto; if (!formPhoto) p.photo = ""; }
  if (editing == null) draft.unshift(p); else draft[editing] = p;
  setTab("products"); renderAdminList(); markDirty();
  setStatus(`"${name}" listo. Toca "Guardar cambios" para que se vea en la tienda.`);
});
$("newProduct").onclick = () => openForm(null);
$("newKit").onclick = () => openForm(null, true);

/* ---------- Kits ---------- */
// A kit lists products already in the store; its photo is optional (the store shows its products' photos).
function kitOptions(selected){
  const self = editing == null ? null : draft[editing].id;
  return `<option value="">Elige un producto</option>` + draft.filter(p => !Array.isArray(p.kit) && p.id !== self)
    .map(p => `<option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>${esc(p.brand ? p.brand + " · " : "")}${esc(p.name)}${p.price ? " — " + money(p.price) : ""}</option>`).join("");
}
function kitRow(id, qty){
  const row = document.createElement("div"); row.className = "kit-row";
  row.innerHTML = `<select aria-label="Producto del kit">${kitOptions(id)}</select><input type="number" min="1" step="1" value="${Number(qty) || 1}" aria-label="Cantidad"><button class="icon-btn" type="button" aria-label="Quitar del kit">×</button>`;
  row.querySelector("button").onclick = () => { row.remove(); updateKitSum(); };
  row.addEventListener("input", updateKitSum); row.addEventListener("change", updateKitSum);
  $("kitRows").appendChild(row);
}
function readKit(){
  return [...$("kitRows").querySelectorAll(".kit-row")].map(r => ({id: r.querySelector("select").value, qty: Math.max(1, Number(r.querySelector("input").value) || 1)})).filter(k => k.id);
}
function updateKitSum(){
  const items = readKit();
  const sum = items.reduce((s, k) => { const p = draft.find(x => x.id === k.id); return s + (p && p.price ? p.price * k.qty : 0); }, 0);
  const price = Number(String($("fPrice").value).replace(/[^\d]/g, "")) || 0;
  const out = items.map(k => draft.find(x => x.id === k.id)).filter(p => p && (p.sold || (hasStock(p) && Number(p.stock) <= 0)));
  $("kitSum").textContent = !items.length ? "Agrega al menos 2 productos." :
    `Por separado: ${money(sum)}${price ? (price < sum ? ` · La clienta ahorra ${money(sum - price)}` : " · Ojo: el precio del kit no es menor que por separado") : ""}. La cantidad disponible se calcula sola con la de cada producto.` +
    (out.length ? ` Ojo: ${out.map(p => p.name).join(", ")} está agotado, así que el kit saldrá agotado.` : "");
}
$("addKitItem").onclick = () => { kitRow("", 1); };
$("fPrice").addEventListener("input", () => { if (formIsKit) updateKitSum(); });

/* ---------- Save to GitHub ---------- */
$("publishBtn").onclick = () => save();
// Saves draft products and settings to GitHub. Returns true on success.
async function save(okMsg){
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
    const outSettings = clone(draftSettings);
    // Plain codes stay in this browser session only; the saved file keeps the hash.
    const plain = Object.fromEntries((draftSettings.promos || []).filter(x => x._code).map(x => [x.id, x._code]));
    outSettings.promos = (outSettings.promos || []).map(({_code, ...rest}) => rest);
    if (outSettings._newHeroPhoto) {
      setStatus("Subiendo foto de portada…");
      const {sha} = await api("/api/blob", {content: outSettings._newHeroPhoto.split(",")[1]});
      const path = `img/hero-${Date.now().toString(36)}.jpg`;
      files.push({path, sha});
      outSettings.heroPhoto = path; delete outSettings._newHeroPhoto;
    }
    const pendingRev = (outSettings.reviews || []).filter(r => r._newPhoto);
    for (let i = 0; i < pendingRev.length; i++) {
      const r = pendingRev[i];
      setStatus(`Subiendo fotos de reseñas… ${i + 1} de ${pendingRev.length}`);
      const {sha} = await api("/api/blob", {content: r._newPhoto.split(",")[1]});
      const path = `img/${r.id}-${Date.now().toString(36)}.jpg`;
      files.push({path, sha});
      r.photo = path; delete r._newPhoto;
    }
    const revPhotos = s => (s.reviews || []).map(r => r.photo).filter(Boolean);
    const keep = new Set(out.map(p => p.photo).filter(Boolean).concat(outSettings.heroPhoto || [], revPhotos(outSettings)));
    const deletes = original.products.map(p => p.photo).concat(original.settings.heroPhoto || [], revPhotos(original.settings))
      .filter(ph => ph && ph.startsWith("img/") && !keep.has(ph));
    setStatus("Guardando…");
    await api("/api/save", {data: {products: out, settings: outSettings}, files, deletes});
    draft = out; draftSettings = outSettings;
    original = {products: clone(out), settings: clone(outSettings)};
    (draftSettings.promos || []).forEach(x => { if (plain[x.id]) x._code = plain[x.id]; });
    if (tab === "promos") renderPromos();
    if (tab === "reviews") renderReviews();
    setHeroPreview();
    dirty = false;
    renderAdminList();
    setStatus(okMsg || "¡Guardado! La tienda se actualiza en 1 minuto más o menos.");
    return true;
  } catch (err) {
    if (err.status === 401) setStatus("Tu sesión expiró. Recarga la página y vuelve a entrar.", true);
    else if (err.status === 409) setStatus("Hubo otro guardado al mismo tiempo. Toca \"Guardar cambios\" otra vez.", true);
    else setStatus("No se pudo guardar: " + err.message, true);
    $("publishBtn").disabled = false;
    return false;
  }
}

/* ---------- Confirm a sale from the WhatsApp order message ---------- */
const norm = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
let saleMatches = null, saleOrder = "";

// Order lines look like "• 2 x e.l.f. Glow Reviver Lip Oil (Pink Quartz) — RD$1,500".
function parseOrder(text){
  const order = (text.match(/Pedido:\s*\*?\s*(MI-\d{6}-\d{4})/i) || [])[1] || "";
  const keys = draft.map(p => ({p, full: norm(`${p.brand || ""} ${p.name}`), name: norm(p.name)}));
  const items = [], unknown = [];
  text.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*[•·\-*]\s*(\d+)\s*[x×]\s*(.+)$/i);
    if (!m) return;
    const qty = Number(m[1]);
    const label = m[2].replace(/\s+[—–-]\s+(RD\$|precio).*$/i, "").trim();
    const bare = norm(label.replace(/\s*\([^)]*\)\s*$/, ""));
    const hit = keys
      .filter(k => bare === k.full || bare.startsWith(k.full) || bare === k.name || bare.endsWith(" " + k.name) || bare.startsWith(k.name))
      .sort((a, b) => b.full.length - a.full.length)[0];
    if (!hit) { unknown.push(label); return; }
    const prev = items.find(i => i.p.id === hit.p.id);
    if (prev) prev.qty += qty; else items.push({p: hit.p, qty});
  });
  return {order, items, unknown};
}

$("saleCheck").onclick = () => {
  const text = $("saleText").value;
  const parsed = parseOrder(text);
  const {order, unknown} = parsed;
  // A kit sold takes stock from each product inside it.
  const items = [];
  parsed.items.forEach(({p, qty}) => {
    const parts = Array.isArray(p.kit) ? p.kit.map(k => ({p: draft.find(x => x.id === k.id), qty: qty * (Number(k.qty) || 1)})).filter(k => k.p) : [{p, qty}];
    parts.forEach(it => { const prev = items.find(i => i.p.id === it.p.id); if (prev) prev.qty += it.qty; else items.push(it); });
  });
  saleMatches = items; saleOrder = order;
  const done = order && (draftSettings.confirmedOrders || []).includes(order);
  let h = "";
  if (!items.length && !unknown.length) {
    h = `<p class="status err">No encontré productos en el mensaje. Copia el mensaje completo del pedido, incluidas las líneas que empiezan con •.</p>`;
  } else {
    h += `<div class="summary"><h4>Pedido</h4><span>${order ? esc(order) : "Sin número de pedido"}</span></div>`;
    if (done) h += `<p class="notice">Este pedido ya se confirmó antes. Si lo confirmas otra vez, se descuenta de nuevo.</p>`;
    if (items.length) h += `<ul class="alist">${items.map(({p, qty}) => {
      const tracked = hasStock(p), now = Number(p.stock), after = Math.max(0, now - qty);
      return `<li class="arow" style="grid-template-columns:56px 1fr">
        <div class="thumb">${photoURL(p) ? `<img src="${esc(photoURL(p))}" alt="">` : drawing(p)}</div>
        <div class="info"><b>${qty} × ${esc(p.name)}</b><span>${tracked ? `Quedan ${now} → quedarán <strong>${after}</strong>${after === 0 ? " (se marca agotado)" : ""}${qty > now ? " · ojo: pidieron más de lo que había" : ""}` : "Sin control de cantidad: no cambia"}</span></div>
      </li>`;}).join("")}</ul>`;
    if (unknown.length) h += `<p class="status err">No reconocí: ${unknown.map(esc).join(", ")}. Revisa que el producto siga existiendo con el mismo nombre.</p>`;
    const changes = items.filter(i => hasStock(i.p)).length;
    h += changes
      ? `<button class="btn" type="button" id="saleConfirm">Confirmar venta y descontar</button>`
      : `<p class="hint">Ninguno de estos productos tiene cantidad disponible configurada, así que no hay nada que descontar.</p>`;
  }
  $("saleResult").innerHTML = h; $("saleResult").hidden = false;
};

$("saleResult").addEventListener("click", async e => {
  if (!e.target.closest("#saleConfirm") || !saleMatches) return;
  const btn = e.target.closest("#saleConfirm"); btn.disabled = true;
  saleMatches.forEach(({p, qty}) => {
    const d = draft.find(x => x.id === p.id);
    if (d && hasStock(d)) d.stock = Math.max(0, Number(d.stock) - qty);
  });
  if (saleOrder) draftSettings.confirmedOrders = [saleOrder, ...(draftSettings.confirmedOrders || []).filter(o => o !== saleOrder)].slice(0, 300);
  markDirty();
  const ok = await save(`¡Venta ${saleOrder || ""} confirmada! La cantidad disponible ya se actualizó.`);
  if (ok) { $("saleText").value = ""; $("saleResult").hidden = true; saleMatches = null; renderAdminList(); }
  else btn.disabled = false;
});

/* ---------- Promo codes ---------- */
async function promoHash(code){
  const data = new TextEncoder().encode("mielle:" + code.trim().toUpperCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const promoText = x => x.type === "percent" ? `${x.value}% de descuento` : x.type === "fixed" ? `${money(x.value)} de descuento` : "Envío gratis";
const promoExpired = x => !!x.expires && new Date() > new Date(x.expires + "T23:59:59");
const fmtDate = d => { const [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; };

function syncPromoType(){
  const t = $("pType").value;
  $("pValueField").hidden = t === "freeship";
  $("pValueLabel").textContent = t === "percent" ? "Descuento (%)" : "Descuento (RD$)";
  $("pValue").placeholder = t === "percent" ? "10" : "200";
}
$("pType").addEventListener("change", syncPromoType);
syncPromoType();

function renderPromos(){
  const list = draftSettings.promos || [];
  if (!list.length) { $("promoList").innerHTML = `<li class="empty">Todavía no tienes códigos.</li>`; return; }
  $("promoList").innerHTML = list.map((x, i) => {
    const state = x.active === false ? "Pausado" : promoExpired(x) ? "Vencido" : "Activo";
    const name = x._code || `${x.hint || ""}•••`;
    return `<li class="arow" data-i="${i}" style="grid-template-columns:1fr auto">
      <div class="info"><b>${esc(name)} · ${esc(promoText(x))}</b><span>${state}${x.min ? " · Mínimo " + money(x.min) : ""}${x.expires ? " · Vence " + fmtDate(x.expires) : ""}</span></div>
      <div class="acts">
        <button class="btn ghost sm" type="button" data-pact="toggle">${x.active === false ? "Activar" : "Pausar"}</button>
        <button class="btn danger sm" type="button" data-pact="del">Borrar</button>
      </div>
    </li>`;
  }).join("");
}
$("promoList").addEventListener("click", e => {
  const b = e.target.closest("[data-pact]"); if (!b) return;
  const i = Number(b.closest("li").dataset.i), list = draftSettings.promos;
  if (b.dataset.pact === "toggle") { list[i].active = list[i].active === false; }
  else {
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "¿Seguro?"; return; }
    list.splice(i, 1);
  }
  markDirty(); renderPromos();
});

$("pCreate").onclick = async () => {
  const code = $("pCode").value.replace(/\s+/g, "").toUpperCase();
  const type = $("pType").value;
  const value = Number(String($("pValue").value).replace(/[^\d]/g, "")) || 0;
  const min = Number(String($("pMin").value).replace(/[^\d]/g, "")) || 0;
  if (!/^[A-Z0-9]{3,20}$/.test(code)) { setStatus("El código debe tener de 3 a 20 letras o números, sin espacios ni símbolos.", true); $("pCode").focus(); return; }
  if (type === "percent" && (value < 1 || value > 100)) { setStatus("El porcentaje debe estar entre 1 y 100.", true); $("pValue").focus(); return; }
  if (type === "fixed" && value < 1) { setStatus("Escribe cuántos pesos de descuento.", true); $("pValue").focus(); return; }
  const hash = await promoHash(code);
  draftSettings.promos = draftSettings.promos || [];
  if (draftSettings.promos.some(x => x.hash === hash)) { setStatus(`Ya tienes el código ${code}.`, true); return; }
  draftSettings.promos.unshift({
    id: "c" + Date.now().toString(36), hash, hint: code.slice(0, 3), type,
    value: type === "freeship" ? 0 : value, min, expires: $("pExp").value || null,
    active: $("pActive").checked, _code: code
  });
  $("pCode").value = ""; $("pValue").value = ""; $("pMin").value = ""; $("pExp").value = ""; $("pActive").checked = true;
  renderPromos(); markDirty();
  setStatus(`Código ${code} creado. Toca "Guardar cambios" para activarlo en la tienda.`);
};

/* ---------- Customer reviews ---------- */
let rEditing = null, rPhoto = "", rPhotoNew = false;
const revPhotoURL = r => r._newPhoto || (r.photo ? "/" + r.photo : "");

function fillReviewProducts(){
  const cur = $("rProduct").value;
  $("rProduct").innerHTML = `<option value="">Elige el artículo</option>` +
    draft.map(p => `<option value="${esc(p.id)}">${esc(p.brand ? p.brand + " · " : "")}${esc(p.name)}</option>`).join("");
  if (draft.some(p => p.id === cur)) $("rProduct").value = cur;
}
function setReviewPhoto(src, isNew){
  rPhoto = src || ""; rPhotoNew = !!isNew && !!src;
  $("rPrev").innerHTML = rPhoto ? `<img src="${esc(rPhoto)}" alt="Vista previa">` : "Sin foto";
}
function resetReviewForm(){
  rEditing = null; setReviewPhoto("", false);
  $("rPhoto").value = ""; $("rName").value = ""; $("rText").value = ""; $("rStars").value = "5"; $("rActive").checked = true;
  $("rProduct").value = "";
  $("rFormTitle").textContent = "Agregar reseña de una clienta"; $("rSave").textContent = "Agregar reseña"; $("rCancel").hidden = true;
}
function renderReviews(){
  const list = draftSettings.reviews || [];
  if (!list.length) { $("reviewList").innerHTML = `<li class="empty">Todavía no hay reseñas.</li>`; return; }
  $("reviewList").innerHTML = list.map((r, i) => {
    const p = draft.find(x => x.id === r.productId);
    return `<li class="arow" data-i="${i}">
      <div class="thumb">${revPhotoURL(r) ? `<img src="${esc(revPhotoURL(r))}" alt="">` : ""}</div>
      <div class="info"><b>${esc(r.name || "Clienta")} · ${"★".repeat(Number(r.stars) || 5)}</b><span>${p ? esc(p.name) : "Producto borrado"}${r.active === false ? " · Oculta" : ""}</span></div>
      <div class="acts">
        <button class="icon-btn" type="button" data-ract="up" aria-label="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-btn" type="button" data-ract="down" aria-label="Bajar" ${i === list.length - 1 ? "disabled" : ""}>↓</button>
        <button class="btn ghost sm" type="button" data-ract="edit">Editar</button>
        <button class="btn danger sm" type="button" data-ract="del">Borrar</button>
      </div>
    </li>`;
  }).join("");
}
$("reviewList").addEventListener("click", e => {
  const b = e.target.closest("[data-ract]"); if (!b) return;
  const list = draftSettings.reviews, i = Number(b.closest("li").dataset.i), act = b.dataset.ract;
  if (act === "up" && i > 0) { [list[i-1], list[i]] = [list[i], list[i-1]]; }
  else if (act === "down" && i < list.length - 1) { [list[i+1], list[i]] = [list[i], list[i+1]]; }
  else if (act === "edit") {
    const r = list[i]; rEditing = i;
    fillReviewProducts();
    setReviewPhoto(revPhotoURL(r), !!r._newPhoto);
    $("rProduct").value = r.productId || ""; $("rStars").value = String(r.stars || 5);
    $("rName").value = r.name || ""; $("rText").value = r.text || ""; $("rActive").checked = r.active !== false;
    $("rFormTitle").textContent = "Editar reseña"; $("rSave").textContent = "Guardar reseña"; $("rCancel").hidden = false;
    window.scrollTo({top: 0}); return;
  }
  else if (act === "del") {
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "¿Seguro?"; return; }
    list.splice(i, 1);
    if (rEditing === i) resetReviewForm();
  } else return;
  markDirty(); renderReviews();
});
$("rPhoto").addEventListener("change", async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  setStatus("Preparando la foto…");
  try { setReviewPhoto(await shrink(f, 1000), true); setStatus(""); }
  catch (err) { setStatus("No pude abrir esa foto. Prueba con una JPG o PNG.", true); }
});
$("rCancel").onclick = () => { resetReviewForm(); setStatus(""); };
$("rSave").onclick = () => {
  if (!rPhoto) { setStatus("Elige la foto de la clienta.", true); return; }
  if (!$("rProduct").value) { setStatus("Elige el artículo que compró.", true); $("rProduct").focus(); return; }
  draftSettings.reviews = draftSettings.reviews || [];
  const base = rEditing == null ? {id: "r" + Date.now().toString(36), photo: ""} : draftSettings.reviews[rEditing];
  const r = Object.assign({}, base, {
    productId: $("rProduct").value, stars: Number($("rStars").value) || 5,
    name: $("rName").value.trim(), text: $("rText").value.trim(), active: $("rActive").checked
  });
  if (rPhotoNew) r._newPhoto = rPhoto; else delete r._newPhoto;
  const isNew = rEditing == null;
  if (isNew) draftSettings.reviews.unshift(r); else draftSettings.reviews[rEditing] = r;
  resetReviewForm(); renderReviews(); markDirty();
  setStatus(`Reseña ${isNew ? "agregada" : "actualizada"}. Toca "Guardar cambios" para publicarla en la tienda.`);
};
