// Mielle store: catalog, cart, checkout, invoice image and WhatsApp order.
const $ = id => document.getElementById(id);
const photoURL = p => p.photo ? (/^(https?:|data:|\/)/.test(p.photo) ? p.photo : "/" + p.photo) : "";
const IG_DM = "https://ig.me/m/shopmiellerd";
const CATS = {kits:"Kits y regalos",maquillaje:"Maquillaje",cabello:"Cabello",cuerpo:"Cuerpo y fragancias",accesorios:"Accesorios",bienestar:"Bienestar"};
const PROVINCES = ["Distrito Nacional","Santo Domingo","Santiago","Azua","Bahoruco","Barahona","Dajabón","Duarte","Elías Piña","El Seibo","Espaillat","Hato Mayor","Hermanas Mirabal","Independencia","La Altagracia","La Romana","La Vega","María Trinidad Sánchez","Monseñor Nouel","Monte Cristi","Monte Plata","Pedernales","Peravia","Puerto Plata","Samaná","San Cristóbal","San José de Ocoa","San Juan","San Pedro de Macorís","Sánchez Ramírez","Santiago Rodríguez","Valverde"];
const DEFAULT_SETTINGS = {
  whatsapp: "",
  shipping: [
    {id:"s1", name:"Caribe Express", cost:null, note:"Retiras en la sucursal de tu provincia", branch:true},
    {id:"s2", name:"Vimenpaq", cost:null, note:"Retiras en la sucursal de tu provincia", branch:true},
    {id:"s3", name:"Metro Pac", cost:null, note:"Retiras en la terminal de Metro de tu ciudad", branch:true},
    {id:"s4", name:"Domex", cost:null, note:"Envío a tu provincia", branch:true},
    {id:"s5", name:"Delivery a domicilio", cost:null, note:"Santo Domingo y Distrito Nacional", branch:false},
    {id:"s6", name:"Retiro en persona", cost:0, note:"Coordinamos el punto de entrega", branch:false}
  ],
  payments: ["Transferencia bancaria", "Efectivo al recibir"],
  bank: "",
  announcement: "🚚 Enviamos a toda República Dominicana",
  heroTitle: "",
  heroText: "",
  heroPhoto: "",
  heroProduct: "",
  freeShipFrom: null,
  lowStockAt: 3,
  promos: [],
  reviews: []
};
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => Number(n).toLocaleString("en-US");
const money = n => "RD$" + fmt(n);
const toJSON = v => JSON.stringify(v).replace(/</g, "\\u003c");
const clone = v => JSON.parse(JSON.stringify(v));
const local = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

let products = [];
let settings = clone(DEFAULT_SETTINGS);
let filter = "todo";
const toneSel = {};

function waNumber(raw){
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10 && /^(809|829|849)/.test(d)) d = "1" + d;
  return d;
}
let toastTimer;
function toast(msg){
  $("toast").textContent = msg; $("toast").hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("toast").hidden = true; }, 2600);
}

/* ---------- Catalog ---------- */
function drawing(p, cls){
  return `<svg class="${cls}" viewBox="0 0 60 100" aria-hidden="true"><use href="#i-${esc(p.icon || "bottle")}"/></svg>`;
}
const firstTone = p => (p.tones && p.tones[0] ? p.tones[0][0] : "");
const hasStock = p => p.stock !== undefined && p.stock !== null && p.stock !== "";
/* Kits are products whose `kit` lists other products [{id, qty}]; their stock comes from those products. */
const isKit = p => Array.isArray(p.kit) && p.kit.length > 0;
const kitParts = p => (p.kit || []).map(k => ({p: products.find(x => x.id === k.id), qty: Math.max(1, Number(k.qty) || 1)})).filter(k => k.p);
const kitRegular = p => { const parts = kitParts(p); return parts.every(k => k.p.price) ? parts.reduce((s, k) => s + k.p.price * k.qty, 0) : 0; };
function maxQty(p){
  if (isKit(p)) {
    const parts = kitParts(p);
    if (!parts.length || parts.some(k => k.p.sold)) return 0;
    return Math.min(99, ...parts.map(k => hasStock(k.p) ? Math.floor(Math.max(0, Number(k.p.stock)) / k.qty) : 99));
  }
  return hasStock(p) ? Math.max(0, Number(p.stock)) : 99;
}
const isOut = p => !!p.sold || (isKit(p) ? maxQty(p) <= 0 : hasStock(p) && Number(p.stock) <= 0);
function lowLeft(p){
  if (isOut(p)) return null;
  const left = isKit(p) ? maxQty(p) : hasStock(p) ? Number(p.stock) : 99;
  return left <= Number(settings.lowStockAt ?? 3) ? left : null;
}
const isTop = p => p.badge === "top" || (!p.badge && p.featured);
// Newer admin products carry createdAt; ids made by the panel ("p" + base-36 time) also encode it.
const createdOf = p => p.createdAt || (/^p[a-z0-9]{7,}$/.test(p.id) ? parseInt(p.id.slice(1), 36) : 0);
function badgeOf(p){
  if (isOut(p)) return ["Agotado", "dark"];
  const left = lowLeft(p);
  if (left != null) return [left === 1 ? "¡Última unidad!" : `¡Quedan ${left}!`, "warn"];
  if (isTop(p)) return ["Más vendido", ""];
  if (p.badge === "nuevo") return ["Nuevo", "new"];
  if (isKit(p)) return ["Kit", "kit"];
  return null;
}
function priceHTML(p){
  if (!p.price) return `<span class="price ask">Precio por DM</span>`;
  const was = isKit(p) ? kitRegular(p) : 0;
  const main = `<span class="price"><small>RD$</small>${fmt(p.price)}</span>`;
  return was > p.price ? `<span class="pw">${main}<s class="was">${money(was)}</s></span>` : main;
}
// A kit without its own photo shows its products' photos together.
function kitCollage(p){
  const shots = kitParts(p).map(k => photoURL(k.p)).filter(Boolean).slice(0, 4);
  if (!shots.length) return "";
  return `<span class="kit-collage n${shots.length}">${shots.map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}</span>`;
}
function card(p, extra){
  const tones = p.tones && p.tones.length
    ? `<span class="dots" aria-label="${p.tones.length} tonos">${p.tones.slice(0, 5).map(([, c]) => `<i style="background:${esc(c)}"></i>`).join("")}<em>${p.tones.length} tonos</em></span>` : "";
  const b = badgeOf(p);
  const badge = b ? `<span class="badge ${b[1]}">${b[0]}</span>` : "";
  const visual = photoURL(p)
    ? `<img src="${esc(photoURL(p))}" alt="${esc(p.brand)} ${esc(p.name)}" loading="lazy">`
    : (isKit(p) && kitCollage(p)) || drawing(p, "draw");
  const parts = isKit(p) ? kitParts(p) : [];
  const kitLine = parts.length ? `<span class="kit-line">${parts.reduce((s, k) => s + k.qty, 0)} productos${kitRegular(p) > p.price && p.price ? ` · ahorras ${money(kitRegular(p) - p.price)}` : ""}</span>` : "";
  const add = isOut(p) ? "" : `<button class="plus" type="button" data-add="${esc(p.id)}" aria-label="Agregar ${esc(p.name)} al carrito">+</button>`;
  return `<article class="card ${extra || ""}">
    <button class="card-hit" type="button" data-open="${esc(p.id)}" aria-label="Ver ${esc(p.brand)} ${esc(p.name)}">
      <span class="visual">${visual}${badge}</span>
      <span class="body"><span class="brand-s">${esc(p.brand)}</span><span class="name">${esc(p.name)}</span>${tones}${kitLine}</span>
    </button>
    <div class="foot">${priceHTML(p)}${add}</div>
  </article>`;
}
/* Search ignores accents and case and looks in brand, name, type, description and kit contents. */
const norm = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
let query = "";
function matches(p, q){
  if (!q) return true;
  const hay = norm([p.brand, p.name, p.kind, p.desc, CATS[p.cat], ...(p.tones || []).map(t => t[0]), ...kitParts(p).map(k => k.p.brand + " " + k.p.name)].join(" "));
  return q.split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
function render(list){
  const q = norm(query.trim());
  const shown = list.filter(p => (filter === "todo" || p.cat === filter) && matches(p, q));
  $("grid").innerHTML = shown.length ? shown.map(p => card(p)).join("")
    : q ? `<div class="empty"><p>No encontramos “${esc(query.trim())}”.</p><button class="btn ghost sm" type="button" id="qReset">Ver todos los productos</button></div>`
    : `<p class="empty">Pronto tendremos productos aquí.</p>`;
  $("countLabel").textContent = shown.length ? `${shown.length} producto${shown.length === 1 ? "" : "s"}` : "";
  document.querySelectorAll("#cats .chip").forEach(b => {
    const f = b.dataset.f;
    b.hidden = f !== "todo" && !list.some(p => p.cat === f);
    b.setAttribute("aria-pressed", f === filter ? "true" : "false");
  });
}
function renderRail(list){
  let picks = list.filter(p => isTop(p) && !isOut(p));
  if (!picks.length) picks = list.filter(p => !isOut(p)).sort((a, b) => (photoURL(b) ? 1 : 0) - (photoURL(a) ? 1 : 0));
  picks = picks.slice(0, 8);
  $("destacados").hidden = !picks.length;
  $("rail").innerHTML = picks.map(p => card(p, "rail-card")).join("");
}
/* ---------- Customer reviews carousel ---------- */
function renderReviews(){
  const list = (settings.reviews || []).filter(r => r.active !== false && r.photo);
  $("resenas").hidden = !list.length;
  if (!list.length) return;
  $("revCount").textContent = `${list.length} reseña${list.length === 1 ? "" : "s"}`;
  $("revRail").innerHTML = list.map(r => {
    const p = products.find(x => x.id === r.productId);
    const stars = Math.max(1, Math.min(5, Number(r.stars) || 5));
    const prod = p ? `<button class="rev-prod" type="button" data-open="${esc(p.id)}">
        ${photoURL(p) ? `<img src="${esc(photoURL(p))}" alt="">` : `<span class="thumb">${drawing(p, "")}</span>`}
        <span><b>${esc(p.name)}</b><small>${esc(p.brand || "")}${p.price ? " · " + money(p.price) : ""}</small></span>
      </button>` : "";
    return `<article class="rev-card">
      <div class="rev-photo"><img src="${esc(photoURL(r))}" alt="Foto de ${esc(r.name || "una clienta")}" loading="lazy"></div>
      <div class="rev-body">
        <span class="rev-stars" aria-label="${stars} de 5 estrellas">${"★".repeat(stars)}<span>${"★".repeat(5 - stars)}</span></span>
        ${r.text ? `<p>“${esc(r.text)}”</p>` : ""}
        ${r.name ? `<span class="rev-name">${esc(r.name)}</span>` : ""}
        ${prod}
      </div>
    </article>`;
  }).join("");
}
$("revRail").addEventListener("click", e => {
  const b = e.target.closest("[data-open]"); if (!b) return;
  const p = products.find(x => x.id === b.dataset.open); if (p) openSheet(p);
});

function heroProduct(){
  if (settings.heroProduct) { const p = products.find(x => x.id === settings.heroProduct); if (p) return p; }
  const avail = products.filter(p => !isOut(p));
  if (!avail.length) return null;
  const dated = avail.filter(p => createdOf(p) > 0).sort((a, b) => createdOf(b) - createdOf(a));
  // New products go to the top of the list in the panel, so the first one is the newest otherwise.
  return dated[0] || avail[0];
}
function renderHero(){
  if (settings.announcement) $("announceText").textContent = settings.announcement;
  $("announce").hidden = !settings.announcement;
  const hp = heroProduct();
  const custom = settings.heroPhoto ? photoURL({photo: settings.heroPhoto}) : "";
  if (hp) {
    $("heroEyebrow").textContent = `Nuevo en Mielle${hp.brand ? " · " + hp.brand : ""}`;
    $("heroTitle").textContent = settings.heroTitle || hp.name;
    $("heroText").textContent = settings.heroText || hp.desc || "";
    $("heroText").hidden = !(settings.heroText || hp.desc);
    $("heroPrice").innerHTML = priceHTML(hp); $("heroPrice").hidden = false;
    $("heroCta").hidden = false; $("heroCta").dataset.open = hp.id;
    $("heroArt").dataset.open = hp.id; $("heroArt").classList.add("clickable");
    const img = custom || photoURL(hp);
    $("heroArt").innerHTML = img
      ? `<img class="hero-img" src="${esc(img)}" alt="${esc(hp.brand)} ${esc(hp.name)}"><span class="badge new hero-badge">Nuevo</span>`
      : `<div class="hero-fallback">${drawing(hp, "draw hero-draw")}<span class="hero-word">${esc(hp.brand || "MIELLE")}</span></div><span class="badge new hero-badge">Nuevo</span>`;
  } else {
    if (settings.heroTitle) $("heroTitle").textContent = settings.heroTitle;
    if (settings.heroText) $("heroText").textContent = settings.heroText;
    if (custom) $("heroArt").innerHTML = `<img class="hero-img" src="${esc(custom)}" alt="Productos de Mielle">`;
  }
}
$("heroCta").addEventListener("click", () => { const p = products.find(x => x.id === $("heroCta").dataset.open); if (p) openSheet(p); });
$("heroArt").addEventListener("click", () => { const p = products.find(x => x.id === $("heroArt").dataset.open); if (p) openSheet(p); });
document.querySelectorAll("#cats .chip").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; render(products); }));
let searchTimer;
$("q").addEventListener("input", () => {
  $("qClear").hidden = !$("q").value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { query = $("q").value; render(products); }, 120);
});
$("q").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("q").blur(); } });
function clearSearch(){ $("q").value = ""; query = ""; $("qClear").hidden = true; filter = "todo"; render(products); }
$("qClear").onclick = () => { clearSearch(); $("q").focus(); };
$("grid").addEventListener("click", e => { if (e.target.closest("#qReset")) clearSearch(); });

function quickAdd(p){
  if (p.tones && p.tones.length) { openSheet(p); return; }
  if (addToCart(p.id, "")) toast(`Agregado: ${p.name}`);
}
function onCatalogClick(e){
  const a = e.target.closest("[data-add]");
  if (a) { const p = products.find(x => x.id === a.dataset.add); if (p) quickAdd(p); return; }
  const o = e.target.closest("[data-open]");
  if (o) { const p = products.find(x => x.id === o.dataset.open); if (p) openSheet(p); }
}
$("grid").addEventListener("click", onCatalogClick);
$("rail").addEventListener("click", onCatalogClick);

/* ---------- Product detail sheet ---------- */
let sheetProduct = null, sheetQty = 1;
function openSheet(p){
  sheetProduct = p; sheetQty = 1;
  toneSel[p.id] = toneSel[p.id] || firstTone(p);
  // The whole photo shows (contain); a blurred copy fills the space around it.
  $("sheetPhoto").innerHTML = photoURL(p)
    ? `<img class="sheet-bg" src="${esc(photoURL(p))}" alt="" aria-hidden="true"><img class="sheet-img" src="${esc(photoURL(p))}" alt="${esc(p.brand)} ${esc(p.name)}">`
    : (isKit(p) && kitCollage(p)) || drawing(p, "draw");
  const parts = isKit(p) ? kitParts(p) : [];
  $("sheetKit").hidden = !parts.length;
  if (parts.length) {
    const reg = kitRegular(p);
    $("sheetKit").innerHTML = `<h3>Este kit incluye</h3><ul>${parts.map(k => `<li>
      <span class="thumb">${photoURL(k.p) ? `<img src="${esc(photoURL(k.p))}" alt="">` : drawing(k.p, "")}</span>
      <span><b>${k.qty > 1 ? k.qty + " × " : ""}${esc(k.p.name)}</b><small>${esc(k.p.brand || "")}${k.p.price ? " · " + money(k.p.price) : ""}</small></span>
    </li>`).join("")}</ul>${reg > p.price && p.price ? `<p class="kit-save">Por separado: ${money(reg)} · <b>ahorras ${money(reg - p.price)}</b></p>` : ""}`;
  }
  $("sheetKind").textContent = p.kind || ""; $("sheetKind").hidden = !p.kind;
  $("sheetBrand").textContent = p.brand || "";
  $("sheetName").textContent = p.name;
  $("sheetPrice").innerHTML = priceHTML(p);
  $("sheetDesc").textContent = p.desc || ""; $("sheetDesc").hidden = !p.desc;
  $("sheetHow").textContent = p.howto || ""; $("sheetHowWrap").hidden = !p.howto;
  const hasTones = !!(p.tones && p.tones.length);
  $("sheetTonesField").hidden = !hasTones;
  if (hasTones) renderSheetTones();
  $("qVal").textContent = 1;
  $("sheetBuy").hidden = isOut(p); $("sheetNow").hidden = isOut(p);
  if (isOut(p)) $("sheetPrice").insertAdjacentHTML("beforeend", ` <span class="badge dark">Agotado</span>`);
  const left = lowLeft(p);
  $("sheetStock").textContent = left == null ? "" : left === 1 ? "¡Solo queda 1 unidad!" : `¡Solo quedan ${left} unidades!`;
  $("sheetStock").hidden = left == null;
  $("sheet").hidden = false; document.body.style.overflow = "hidden";
  $("sheet").querySelector(".sheet-box").scrollTop = 0;
  $("closeSheet").focus();
}
function renderSheetTones(){
  const p = sheetProduct, sel = toneSel[p.id];
  $("sheetToneName").textContent = sel;
  $("sheetTones").innerHTML = p.tones.map(([n, c]) => `<button type="button" class="tone" data-tone="${esc(n)}" aria-pressed="${n === sel}"><i style="background:${esc(c)}"></i>${esc(n)}</button>`).join("");
}
function closeSheet(){ $("sheet").hidden = true; document.body.style.overflow = ""; sheetProduct = null; }
$("sheetTones").addEventListener("click", e => {
  const t = e.target.closest(".tone"); if (!t || !sheetProduct) return;
  toneSel[sheetProduct.id] = t.dataset.tone; renderSheetTones();
});
$("qMinus").onclick = () => { sheetQty = Math.max(1, sheetQty - 1); $("qVal").textContent = sheetQty; };
$("qPlus").onclick = () => {
  const room = sheetProduct ? maxQty(sheetProduct) - inCart(sheetProduct.id) : 20;
  sheetQty = Math.max(1, Math.min(20, room, sheetQty + 1)); $("qVal").textContent = sheetQty;
};
function addFromSheet(){
  const p = sheetProduct; if (!p) return;
  const tone = toneSel[p.id] || "";
  const added = addToCart(p.id, tone, sheetQty);
  if (added) toast(`Agregado: ${added > 1 ? added + " × " : ""}${p.name}${tone ? " · " + tone : ""}`);
}
$("sheetAdd").onclick = () => { addFromSheet(); closeSheet(); };
$("sheetNow").onclick = () => { addFromSheet(); closeSheet(); openCart(); };
$("closeSheet").onclick = closeSheet;
$("sheet").addEventListener("click", e => { if (e.target === $("sheet")) closeSheet(); });
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("sheet").hidden) closeSheet(); else if (!$("cart").hidden) closeCart();
});

/* ---------- Cart ---------- */
let cart = [];
let step = 0; // 0 cart, 1 datos, 2 envío y pago, 3 confirmar, 4 listo
let lastOrder = null;

function saveCart(){ local.set("mielle-cart", cart); updateCount(); }
const inCart = id => cart.filter(i => i.id === id).reduce((s, i) => s + i.qty, 0);
function updateCount(){
  const n = cart.reduce((s, i) => s + i.qty, 0);
  $("cartCount").textContent = n;
  $("cartBarN").textContent = n;
  const c = calc();
  $("cartBarTotal").textContent = c.subtotal ? money(c.subtotal - c.discount) : "";
  $("cartBar").hidden = !n || !$("cart").hidden;
}
function bump(){
  [$("cartCount"), $("cartBar")].forEach(el => { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); });
}
// Adds up to n units without going over the stock; returns how many were added.
function addToCart(id, tone, n = 1){
  const p = products.find(x => x.id === id); if (!p || isOut(p)) return 0;
  const room = maxQty(p) - inCart(id);
  const add = Math.min(n, room);
  if (add <= 0) { toast(`Solo hay ${maxQty(p)} disponible${maxQty(p) === 1 ? "" : "s"} de ${p.name}`); return 0; }
  const hit = cart.find(i => i.id === id && i.tone === tone);
  if (hit) hit.qty += add; else cart.push({id, tone, qty: add});
  saveCart(); bump();
  if (add < n) toast(`Solo quedaban ${add} de ${p.name}`);
  return add;
}
function lines(){
  return cart.map(i => {
    const p = products.find(x => x.id === i.id);
    return p ? {p, tone: i.tone, qty: i.qty, total: p.price ? p.price * i.qty : null} : null;
  }).filter(Boolean);
}
function currentShip(){ return settings.shipping.find(s => s.id === (document.querySelector('input[name="ship"]:checked') || {}).value); }
function calc(){
  const ls = lines();
  const subtotal = ls.reduce((s, l) => s + (l.total || 0), 0);
  const unpriced = ls.some(l => l.total == null);
  const ship = currentShip();
  const pr = promoResult(subtotal);
  const free = freeShip(subtotal) || !!(pr && pr.ok && pr.def.type === "freeship");
  const shipCost = ship ? (free ? 0 : ship.cost != null ? Number(ship.cost) : null) : null;
  const discount = pr && pr.ok ? pr.discount : 0;
  return {ls, subtotal, unpriced, ship, shipCost, free, promo: pr, discount, total: subtotal - discount + (shipCost || 0)};
}
/* ---------- Promo codes ----------
   Codes are stored as SHA-256 hashes in products.json so they can't be read from the public file. */
let promo = null; // {code, def}
async function promoHash(code){
  const data = new TextEncoder().encode("mielle:" + code.trim().toUpperCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function promoExpired(def){
  if (!def.expires) return false;
  return new Date() > new Date(def.expires + "T23:59:59");
}
function promoResult(subtotal){
  if (!promo) return null;
  const def = promo.def, min = Number(def.min) || 0;
  if (subtotal < min) return {code: promo.code, def, ok: false, need: min - subtotal, discount: 0};
  let discount = 0;
  if (def.type === "percent") discount = Math.round(subtotal * Math.min(100, Number(def.value) || 0) / 100);
  else if (def.type === "fixed") discount = Math.min(subtotal, Number(def.value) || 0);
  return {code: promo.code, def, ok: true, need: 0, discount};
}
function promoLabel(def){
  return def.type === "percent" ? `${def.value}% de descuento` : def.type === "fixed" ? `${money(def.value)} de descuento` : "Envío gratis";
}
async function findPromo(code){
  const h = await promoHash(code);
  const def = (settings.promos || []).find(p => p.hash === h);
  if (!def) return {error: "Código no válido. Revisa que esté bien escrito."};
  if (def.active === false) return {error: "Ese código ya no está activo."};
  if (promoExpired(def)) return {error: "Ese código ya venció."};
  return {def};
}
async function applyPromo(code, quiet){
  code = code.trim().toUpperCase();
  const r = await findPromo(code);
  if (r.error) { if (!quiet) promoMsg(r.error, true); return false; }
  promo = {code, def: r.def};
  local.set("mielle-promo", code);
  if (!quiet) toast(`Código ${code} aplicado`);
  renderPromo();
  return true;
}
function removePromo(){ promo = null; local.set("mielle-promo", ""); renderPromo(); }
function promoMsg(t, err){
  $("promoMsg").textContent = t || ""; $("promoMsg").classList.toggle("err", !!err);
  $("promoInput").classList.toggle("bad", !!err && !promo);
}
function renderPromo(){
  // Always offered while there is something to buy, even before any code exists.
  $("promoForm").hidden = !cart.length;
  const on = !!promo;
  $("promoOn").hidden = !on;
  $("promoInput").closest(".promo-row").hidden = on;
  if (on) {
    const c = calc();
    $("promoOnText").innerHTML = `<b>${esc(promo.code)}</b> · ${esc(promoLabel(promo.def))}`;
    promoMsg(c.promo && !c.promo.ok ? `Agrega ${money(c.promo.need)} más para usar este código.` : "", c.promo && !c.promo.ok);
  } else promoMsg("");
  if (step === 0) $("cartTotals").innerHTML = cart.length ? totalsHTML(calc(), false) : "";
  if (step === 3) renderReview();
  updateCount();
}
$("promoForm").addEventListener("submit", async e => {
  e.preventDefault();
  const code = $("promoInput").value;
  if (!code.trim()) { promoMsg("Escribe tu código.", true); return; }
  $("promoApply").disabled = true;
  try { if (await applyPromo(code)) $("promoInput").value = ""; }
  catch (err) { promoMsg("No se pudo revisar el código. Intenta de nuevo.", true); }
  $("promoApply").disabled = false;
});
$("promoRemove").onclick = removePromo;

const freeFrom = () => Number(settings.freeShipFrom) || 0;
const freeShip = subtotal => freeFrom() > 0 && subtotal >= freeFrom();
function shipLabel(s, subtotal){
  const pr = promoResult(subtotal);
  if (freeShip(subtotal) || (pr && pr.ok && pr.def.type === "freeship")) return "Gratis";
  return s.cost == null || s.cost === "" ? "A cotizar" : Number(s.cost) === 0 ? "Gratis" : money(s.cost);
}
function renderFreeShip(c){
  const goal = freeFrom();
  $("freeShip").hidden = !goal || !c.ls.length;
  if (!goal) return;
  const pct = Math.min(100, Math.round(c.subtotal / goal * 100));
  $("freeShip").innerHTML = (c.subtotal >= goal
    ? `<p><b>🎉 ¡Tienes envío gratis!</b></p>`
    : `<p>Te faltan <b>${money(goal - c.subtotal)}</b> para el <b>envío gratis</b></p>`) +
    `<div class="fs-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="fs-fill" style="width:${pct}%"></div></div>`;
}
function suggestions(n = 3){
  const ids = new Set(cart.map(i => i.id));
  const cats = new Set(lines().map(l => l.p.cat));
  const sub = calc().subtotal, gap = freeFrom() && sub < freeFrom() ? freeFrom() - sub : 0;
  return products
    .filter(p => !ids.has(p.id) && !isOut(p) && p.price)
    .map(p => ({p, score: (cats.has(p.cat) ? 2 : 0) + (isTop(p) ? 1 : 0) + (gap && p.price >= gap ? 1.5 : 0) + (photoURL(p) ? 0.5 : 0)}))
    .sort((a, b) => b.score - a.score).slice(0, n).map(x => x.p);
}
function upsellHTML(title){
  const list = suggestions();
  if (!list.length) return "";
  return `<h3>${title}</h3><div class="up-list">${list.map(p => `<div class="up-item">
    <div class="thumb">${photoURL(p) ? `<img src="${esc(photoURL(p))}" alt="">` : drawing(p, "")}</div>
    <div class="info"><b>${esc(p.name)}</b><span>${esc(p.brand)} · ${money(p.price)}</span></div>
    <button class="btn ghost sm" type="button" data-up="${esc(p.id)}">+ Agregar</button>
  </div>`).join("")}</div>`;
}
function totalsHTML(c, withShip){
  let h = `<div><span>Subtotal</span><span>${money(c.subtotal)}</span></div>`;
  if (c.promo && c.promo.ok && c.discount) h += `<div class="disc"><span>Descuento · ${esc(c.promo.code)}</span><span>−${money(c.discount)}</span></div>`;
  if (withShip) h += `<div><span>Envío${c.ship ? " · " + esc(c.ship.name) : ""}</span><span>${c.shipCost == null ? "A confirmar" : c.shipCost === 0 ? "Gratis" : money(c.shipCost)}</span></div>`;
  else if (c.free) h += `<div><span>Envío</span><span>Gratis</span></div>`;
  h += `<div class="grand"><span>Total</span><span>${money(withShip ? c.total : c.subtotal - c.discount)}</span></div>`;
  const notes = [];
  if (c.unpriced) notes.push("Algunos productos tienen precio por confirmar.");
  if (withShip && c.ship && c.shipCost == null) notes.push("El costo de envío te lo confirmamos por WhatsApp.");
  if (!withShip && !c.free) notes.push("El envío se calcula en el siguiente paso.");
  if (notes.length) h += `<div class="note">${notes.join(" ")}</div>`;
  return h;
}

function renderCartList(){
  const c = calc();
  renderFreeShip(c);
  $("cartTotals").after($("promoForm"));
  renderPromo();
  const up = c.ls.length ? upsellHTML("Completa tu pedido") : "";
  $("upsellCart").innerHTML = up; $("upsellCart").hidden = !up;
  if (!c.ls.length) {
    $("cartList").innerHTML = `<li class="empty">Tu carrito está vacío.</li>`;
    $("cartTotals").innerHTML = "";
    return;
  }
  $("cartList").innerHTML = c.ls.map((l, i) => `<li class="citem" data-i="${i}">
    <div class="thumb">${l.p.photo ? `<img src="${esc(photoURL(l.p))}" alt="">` : drawing(l.p, "")}</div>
    <div class="info"><b>${esc(l.p.name)}</b><span>${esc(l.p.brand)}${l.tone ? " · " + esc(l.tone) : ""} · ${l.total == null ? "Precio por DM" : money(l.total)}</span></div>
    <div class="qty">
      <button class="icon-btn" type="button" data-q="-1" aria-label="Quitar uno">−</button>
      <output aria-label="Cantidad">${l.qty}</output>
      <button class="icon-btn" type="button" data-q="1" aria-label="Agregar uno">+</button>
    </div>
  </li>`).join("");
  $("cartTotals").innerHTML = totalsHTML(c, false);
}
$("cartList").addEventListener("click", e => {
  const b = e.target.closest("[data-q]"); if (!b) return;
  const i = Number(b.closest("li").dataset.i);
  const d = Number(b.dataset.q), p = products.find(x => x.id === cart[i].id);
  if (d > 0 && p && inCart(p.id) >= maxQty(p)) { toast(`Solo hay ${maxQty(p)} disponible${maxQty(p) === 1 ? "" : "s"}`); return; }
  cart[i].qty += d;
  if (cart[i].qty <= 0) cart.splice(i, 1);
  saveCart(); renderCartList(); setStep(0);
});

function fillOptions(){
  $("cProv").innerHTML = `<option value="">Elige tu provincia</option>` + PROVINCES.map(p => `<option>${esc(p)}</option>`).join("");
  $("shipOpts").innerHTML = settings.shipping.map((s, i) => `<label class="opt"><input type="radio" name="ship" value="${esc(s.id)}"><span><b>${esc(s.name)}</b>${s.note ? `<small>${esc(s.note)}</small>` : ""}</span><span class="cost" data-ship="${esc(s.id)}">${shipLabel(s, 0)}</span></label>`).join("");
  $("payOpts").innerHTML = settings.payments.map(p => `<label class="opt"><input type="radio" name="pay" value="${esc(p)}"><span><b>${esc(p)}</b></span><span></span></label>`).join("");
}
$("shipOpts").addEventListener("change", () => { const s = currentShip(); $("branchField").hidden = !(s && s.branch); });

const saved = local.get("mielle-cliente", {});
["cName","cPhone","cProv","cCity","cAddr","cRef"].forEach(id => { if (saved[id]) $(id).value = saved[id]; });

function cstatus(msg, err){ $("cstatus").textContent = msg || ""; $("cstatus").classList.toggle("err", !!err); }
function setStep(n){
  step = n;
  ["vCart","vData","vShip","vReview","vDone"].forEach((v, i) => { $(v).hidden = i !== n; });
  $("progress").hidden = n === 0 || n === 4;
  $("progress").querySelectorAll("li").forEach(li => li.classList.toggle("on", Number(li.dataset.s) <= n));
  $("cartTitle").textContent = ["Tu carrito","Tus datos","Envío y pago","Confirma tu pedido","¡Pedido listo!"][n];
  const empty = !cart.length;
  $("backBtn").textContent = n === 0 || n === 4 ? "Seguir comprando" : "Atrás";
  $("nextBtn").hidden = n === 4;
  $("nextBtn").disabled = n === 0 && empty;
  $("nextBtn").textContent = n === 0 ? "Hacer pedido" : n === 3 ? "Confirmar pedido" : "Continuar";
  cstatus("");
  if (n === 2) { const sub = calc().subtotal; settings.shipping.forEach(s => { const el = document.querySelector(`[data-ship="${CSS.escape(s.id)}"]`); if (el) el.textContent = shipLabel(s, sub); }); }
  $("cart").querySelector(".drawer").scrollTop = 0;
}
function openCart(){ renderCartList(); setStep(0); $("cart").hidden = false; document.body.style.overflow = "hidden"; updateCount(); }
function closeCart(){
  $("cart").hidden = true; document.body.style.overflow = ""; updateCount();
  if (step === 4) { lastOrder = null; setStep(0); }
}
$("openCart").onclick = openCart;
$("cartBar").onclick = openCart;
$("cart").addEventListener("click", e => {
  const b = e.target.closest("[data-up]"); if (!b) return;
  const p = products.find(x => x.id === b.dataset.up); if (!p) return;
  const tone = firstTone(p);
  if (!addToCart(p.id, tone)) return;
  toast(`Agregado: ${p.name}${tone ? " · " + tone : ""}`);
  if (step === 3) renderReview(); else renderCartList();
});
$("closeCart").onclick = closeCart;
$("cart").addEventListener("click", e => { if (e.target === $("cart")) closeCart(); });
$("backBtn").onclick = () => { if (step === 0 || step === 4) closeCart(); else setStep(step - 1); };

function need(id, ok){
  $(id).closest(".field").classList.toggle("bad", !ok);
  return ok;
}
function validData(){
  const phone = $("cPhone").value.replace(/\D/g, "");
  const checks = [
    need("cName", $("cName").value.trim().length >= 3),
    need("cPhone", phone.length >= 10),
    need("cProv", !!$("cProv").value),
    need("cCity", !!$("cCity").value.trim()),
    need("cAddr", !!$("cAddr").value.trim())
  ];
  return checks.every(Boolean);
}

function customer(){
  return {
    name: $("cName").value.trim(), phone: $("cPhone").value.trim(), prov: $("cProv").value,
    city: $("cCity").value.trim(), addr: $("cAddr").value.trim(), ref: $("cRef").value.trim(),
    branch: $("cBranch").value.trim(), notes: $("cNotes").value.trim(),
    pay: (document.querySelector('input[name="pay"]:checked') || {}).value || ""
  };
}

function renderReview(){
  $("vCart").appendChild($("promoForm")); // keep the promo box out of the way while the review is rebuilt
  const c = calc(), cu = customer();
  $("vReview").innerHTML = `
    <div class="summary"><h4>Cliente</h4><span>${esc(cu.name)}</span><span>${esc(cu.phone)}</span></div>
    <div class="summary"><h4>Entrega</h4><span>${esc(cu.addr)}, ${esc(cu.city)}, ${esc(cu.prov)}</span>${cu.ref ? `<span>Ref.: ${esc(cu.ref)}</span>` : ""}<span>${esc(c.ship.name)}${c.ship.branch && cu.branch ? " · Sucursal: " + esc(cu.branch) : ""}</span></div>
    <div class="summary"><h4>Productos</h4>${c.ls.map(l => `<span>${l.qty} × ${esc(l.p.brand)} ${esc(l.p.name)}${l.tone ? " (" + esc(l.tone) + ")" : ""} — ${l.total == null ? "por confirmar" : money(l.total)}</span>`).join("")}</div>
    <div class="summary"><h4>Pago</h4><span>${esc(cu.pay)}</span>${cu.notes ? `<span>Notas: ${esc(cu.notes)}</span>` : ""}</div>
    <div class="upsell">${upsellHTML("¿Algo más antes de terminar?")}</div>
    <div class="totals">${totalsHTML(c, true)}</div>`;
  $("vReview").querySelector(".totals").after($("promoForm"));
}

$("nextBtn").onclick = async () => {
  if (step === 0) { if (cart.length) setStep(1); return; }
  if (step === 1) {
    if (!validData()) { cstatus("Completa los campos marcados en rojo.", true); return; }
    local.set("mielle-cliente", Object.fromEntries(["cName","cPhone","cProv","cCity","cAddr","cRef"].map(id => [id, $(id).value])));
    setStep(2); return;
  }
  if (step === 2) {
    const s = currentShip();
    if (!s) { cstatus("Elige cómo quieres recibir tu pedido.", true); return; }
    if (s.branch && !$("cBranch").value.trim()) { need("cBranch", false); cstatus("Escribe la sucursal donde vas a retirar.", true); return; }
    need("cBranch", true);
    if (!document.querySelector('input[name="pay"]:checked')) { cstatus("Elige un método de pago.", true); return; }
    renderReview(); setStep(3); return;
  }
  if (step === 3) {
    $("nextBtn").disabled = true; cstatus("Creando tu factura…");
    try { await finishOrder(); } catch (e) { cstatus("No se pudo crear la factura. Intenta de nuevo.", true); $("nextBtn").disabled = false; }
  }
};

function orderNumber(){
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return `MI-${String(d.getFullYear()).slice(2)}${p(d.getMonth()+1)}${p(d.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function waMessage(o){
  const c = o.calc, cu = o.customer;
  const L = [];
  L.push(`*Nuevo pedido MIELLE* 🎀`);
  L.push(`Pedido: ${o.num}`);
  L.push(`Fecha: ${o.date}`);
  L.push("");
  L.push(`*Cliente*`);
  L.push(`Nombre: ${cu.name}`);
  L.push(`Teléfono: ${cu.phone}`);
  L.push(`Dirección: ${cu.addr}, ${cu.city}, ${cu.prov}`);
  if (cu.ref) L.push(`Referencia: ${cu.ref}`);
  L.push("");
  L.push(`*Productos*`);
  const kitNote = p => isKit(p) ? ` (Kit: ${kitParts(p).map(k => (k.qty > 1 ? k.qty + " " : "") + k.p.name).join(" + ")})` : "";
  c.ls.forEach(l => L.push(`• ${l.qty} x ${l.p.brand ? l.p.brand + " " : ""}${l.p.name}${l.tone ? " (" + l.tone + ")" : kitNote(l.p)} — ${l.total == null ? "precio por confirmar" : money(l.total)}`));
  L.push("");
  L.push(`Subtotal: ${money(c.subtotal)}`);
  if (c.promo && c.promo.ok) L.push(`Código ${c.promo.code}: ${c.discount ? "−" + money(c.discount) : promoLabel(c.promo.def)}`);
  L.push(`Envío: ${c.ship.name}${c.ship.branch && cu.branch ? " · Sucursal: " + cu.branch : ""} — ${c.shipCost == null ? "a confirmar" : c.shipCost === 0 ? (c.free ? "gratis (envío gratis)" : "gratis") : money(c.shipCost)}`);
  L.push(`*Total: ${money(c.total)}*${c.shipCost == null || c.unpriced ? " (sin incluir montos por confirmar)" : ""}`);
  L.push(`Pago: ${cu.pay}`);
  if (cu.notes) L.push(`Notas: ${cu.notes}`);
  return L.join("\n");
}

/* Invoice image drawn on a canvas, in the shop's light palette */
const loadLogo = () => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = "/brand/wordmark.png"; });
async function drawInvoice(o){
  const logo = await loadLogo();
  try { await Promise.all([document.fonts.load('500 64px "Bodoni Moda"'), document.fonts.load('40px "Pinyon Script"'), document.fonts.load('400 28px "Jost"'), document.fonts.load('600 28px "Jost"')]); } catch (e) {}
  const C = {bg:"#fbf3ef", card:"#fffaf7", cocoa:"#5a3a33", ink:"#3b2622", rose:"#d98a95", muted:"#8a6a62", line:"#ecd3cf", blush:"#f6d9d9"};
  const W = 1080, P = 72, c = o.calc, cu = o.customer;
  const SERIF = '"Bodoni Moda", Didot, Georgia, serif', SANS = '"Jost", "Avenir Next", "Segoe UI", sans-serif', SCRIPT = '"Pinyon Script", cursive';
  const bankLines = settings.bank && cu.pay.toLowerCase().includes("transfer") ? settings.bank.split("\n").filter(Boolean) : [];
  const H = 4000; // drawn tall, then cropped to the content
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  const text = (t, X, Y, font, color, align) => { x.font = font; x.fillStyle = color; x.textAlign = align || "left"; x.fillText(t, X, Y); };
  const fit = (t, max, font) => { x.font = font; if (x.measureText(t).width <= max) return t; while (t.length > 1 && x.measureText(t + "…").width > max) t = t.slice(0, -1); return t + "…"; };
  const rule = Y => { x.fillStyle = C.line; x.fillRect(P, Y, W - 2 * P, 2); };

  x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
  x.fillStyle = C.blush; x.fillRect(0, 0, W, 14);
  if (logo) { const lw = 520, lh = lw * logo.height / logo.width; x.drawImage(logo, (W - lw) / 2, 168 - lh, lw, lh); }
  else text("MIELLE", W / 2, 150, `500 104px ${SERIF}`, C.cocoa, "center");
  text("Todo lo que te encanta, en un solo lugar", W / 2, 210, `44px ${SCRIPT}`, C.rose, "center");
  text("BEAUTY & LIFESTYLE · REPÚBLICA DOMINICANA", W / 2, 258, `500 22px ${SANS}`, C.muted, "center");

  let y = 330;
  x.fillStyle = C.card; x.strokeStyle = C.line; x.lineWidth = 2;
  x.beginPath(); x.roundRect(P, y, W - 2 * P, 120, 20); x.fill(); x.stroke();
  text("FACTURA DE PEDIDO", P + 32, y + 50, `600 22px ${SANS}`, C.muted);
  text(o.num, P + 32, y + 92, `500 38px ${SERIF}`, C.cocoa);
  text("FECHA", W - P - 32, y + 50, `600 22px ${SANS}`, C.muted, "right");
  text(o.date, W - P - 32, y + 92, `400 28px ${SANS}`, C.ink, "right");

  y += 180;
  text("CLIENTE", P, y, `600 22px ${SANS}`, C.rose);
  y += 42; text(fit(cu.name, W - 2 * P, `500 32px ${SANS}`), P, y, `500 32px ${SANS}`, C.ink);
  y += 40; text(cu.phone, P, y, `400 26px ${SANS}`, C.muted);
  y += 40; text(fit(`${cu.addr}, ${cu.city}, ${cu.prov}`, W - 2 * P, `400 26px ${SANS}`), P, y, `400 26px ${SANS}`, C.muted);
  if (cu.ref) { y += 40; text(fit("Ref.: " + cu.ref, W - 2 * P, `400 26px ${SANS}`), P, y, `400 26px ${SANS}`, C.muted); }
  y += 40; text(fit(`Envío: ${c.ship.name}`, W - 2 * P, `400 26px ${SANS}`), P, y, `400 26px ${SANS}`, C.muted);
  if (cu.branch && c.ship.branch) { y += 40; text(fit("Sucursal: " + cu.branch, W - 2 * P, `400 26px ${SANS}`), P, y, `400 26px ${SANS}`, C.muted); }

  y += 60; text("PRODUCTOS", P, y, `600 22px ${SANS}`, C.rose); text("TOTAL", W - P, y, `600 22px ${SANS}`, C.rose, "right");
  y += 20; rule(y);
  c.ls.forEach(l => {
    y += 48;
    const name = `${l.qty} × ${[l.p.brand, l.p.name].filter(Boolean).join(" ")}`;
    text(fit(name, W - 2 * P - 220, `500 28px ${SANS}`), P, y, `500 28px ${SANS}`, C.ink);
    text(l.total == null ? "Por confirmar" : money(l.total), W - P, y, `500 28px ${SANS}`, C.cocoa, "right");
    const sub = [l.tone, isKit(l.p) ? "Incluye: " + kitParts(l.p).map(k => (k.qty > 1 ? k.qty + " " : "") + k.p.name).join(" + ") : "", l.p.price ? money(l.p.price) + " c/u" : ""].filter(Boolean).join(" · ");
    if (sub) text(fit(sub, W - 2 * P - 220, `400 22px ${SANS}`), P, y + 28, `400 22px ${SANS}`, C.muted);
    y += 28;
  });
  y += 30; rule(y);
  y += 50; text("Subtotal", P, y, `400 28px ${SANS}`, C.muted); text(money(c.subtotal), W - P, y, `400 28px ${SANS}`, C.ink, "right");
  if (c.promo && c.promo.ok && c.discount) { y += 46; text("Descuento · " + c.promo.code, P, y, `400 28px ${SANS}`, C.muted); text("−" + money(c.discount), W - P, y, `400 28px ${SANS}`, C.rose, "right"); }
  y += 46; text("Envío", P, y, `400 28px ${SANS}`, C.muted); text(c.shipCost == null ? "A confirmar" : c.shipCost === 0 ? "Gratis" : money(c.shipCost), W - P, y, `400 28px ${SANS}`, C.ink, "right");
  y += 30; rule(y);
  y += 70; text("Total", P, y, `500 46px ${SERIF}`, C.cocoa); text(money(c.total), W - P, y, `500 46px ${SERIF}`, C.cocoa, "right");
  if (c.shipCost == null || c.unpriced) { y += 36; text("Montos por confirmar no incluidos en el total.", P, y, `400 22px ${SANS}`, C.muted); }
  y += 50; text("Pago: " + cu.pay, P, y, `400 26px ${SANS}`, C.ink);
  if (bankLines.length) {
    y += 50; text("DATOS PARA TRANSFERENCIA", P, y, `600 22px ${SANS}`, C.rose);
    bankLines.forEach(b => { y += 38; text(fit(b, W - 2 * P, `400 26px ${SANS}`), P, y, `400 26px ${SANS}`, C.ink); });
  }
  y += 110;
  text("¡Gracias por tu compra!", W / 2, y, `44px ${SCRIPT}`, C.rose, "center");
  text("@shopmiellerd", W / 2, y + 44, `500 24px ${SANS}`, C.muted, "center");
  const out = document.createElement("canvas"); out.width = W; out.height = y + 100;
  out.getContext("2d").drawImage(cv, 0, 0);
  return out.toDataURL("image/png");
}

async function finishOrder(){
  const c = calc(), cu = customer();
  const d = new Date();
  const o = {num: orderNumber(), date: d.toLocaleDateString("es-DO", {day:"2-digit", month:"2-digit", year:"numeric"}), calc: c, customer: cu};
  o.msg = waMessage(o);
  o.img = await drawInvoice(o);
  lastOrder = o;
  const num = waNumber(settings.whatsapp);
  $("waBtn").href = num ? `https://wa.me/${num}?text=${encodeURIComponent(o.msg)}` : IG_DM;
  $("waBtn").textContent = num ? "Enviar pedido por WhatsApp" : "Enviar pedido por Instagram";
  $("waBtn").classList.toggle("wa", !!num);
  $("doneNum").textContent = o.num;
  $("invoiceImg").src = o.img;
  $("saveInvoice").href = o.img; $("saveInvoice").download = `Factura-${o.num}.png`;
  try {
    const test = new File([new Blob(["x"], {type: "image/png"})], "t.png", {type: "image/png"});
    $("shareInvoice").hidden = !(navigator.canShare && navigator.canShare({files: [test]}));
  } catch (e) { $("shareInvoice").hidden = true; }
  cart = []; saveCart(); removePromo();
  setStep(4);
  if (!num) cstatus("Copia el mensaje y pégalo en el chat de Instagram.");
}

$("copyMsg").onclick = async () => {
  if (!lastOrder) return;
  try { await navigator.clipboard.writeText(lastOrder.msg); toast("Mensaje copiado"); }
  catch (e) { cstatus("No se pudo copiar automáticamente. Usa el botón de WhatsApp.", true); }
};

$("shareInvoice").onclick = async () => {
  if (!lastOrder) return;
  try {
    const blob = await (await fetch(lastOrder.img)).blob();
    const file = new File([blob], `Factura-${lastOrder.num}.png`, {type: "image/png"});
    await navigator.share({files: [file], title: `Factura ${lastOrder.num}`});
  } catch (e) {}
};

/* ---------- Start: load products from products.json ---------- */
(async () => {
  try {
    const r = await fetch("/products.json", {cache: "no-store"});
    const data = await r.json();
    products = Array.isArray(data) ? data : (data.products || []);
    settings = Object.assign(clone(DEFAULT_SETTINGS), data.settings || {});
  } catch (e) {
    $("grid").innerHTML = `<p class="empty">No se pudieron cargar los productos. Recarga la página.</p>`;
  }
  cart = local.get("mielle-cart", []).filter(i => products.some(p => p.id === i.id && !isOut(p)));
  const savedPromo = local.get("mielle-promo", "");
  if (savedPromo) { try { await applyPromo(savedPromo, true); } catch (e) {} }
  render(products);
  renderRail(products);
  renderReviews();
  renderHero();
  fillOptions();
  updateCount();
})();
