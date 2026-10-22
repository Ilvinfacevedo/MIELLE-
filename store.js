// Mielle store: catalog, cart, checkout, invoice image and WhatsApp order.
const $ = id => document.getElementById(id);
const photoURL = p => p.photo ? (/^(https?:|data:|\/)/.test(p.photo) ? p.photo : "/" + p.photo) : "";
const IG_DM = "https://ig.me/m/shopmielle_";
const CATS = {maquillaje:"Maquillaje",cabello:"Cabello",cuerpo:"Cuerpo y fragancias",accesorios:"Accesorios",bienestar:"Bienestar"};
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
  heroPhoto: ""
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
function priceHTML(p){
  return p.price ? `<span class="price"><small>RD$</small>${fmt(p.price)}</span>` : `<span class="price ask">Precio por DM</span>`;
}
function card(p, extra){
  const tones = p.tones && p.tones.length
    ? `<span class="dots" aria-label="${p.tones.length} tonos">${p.tones.slice(0, 5).map(([, c]) => `<i style="background:${esc(c)}"></i>`).join("")}<em>${p.tones.length} tonos</em></span>` : "";
  const badge = p.sold ? `<span class="badge dark">Agotado</span>` : p.featured ? `<span class="badge">Más pedido</span>` : "";
  const visual = photoURL(p)
    ? `<img src="${esc(photoURL(p))}" alt="${esc(p.brand)} ${esc(p.name)}" loading="lazy">`
    : drawing(p, "draw");
  const add = p.sold ? "" : `<button class="plus" type="button" data-add="${esc(p.id)}" aria-label="Agregar ${esc(p.name)} al carrito">+</button>`;
  return `<article class="card ${extra || ""}">
    <button class="card-hit" type="button" data-open="${esc(p.id)}" aria-label="Ver ${esc(p.brand)} ${esc(p.name)}">
      <span class="visual">${visual}${badge}</span>
      <span class="body"><span class="brand-s">${esc(p.brand)}</span><span class="name">${esc(p.name)}</span>${tones}</span>
    </button>
    <div class="foot">${priceHTML(p)}${add}</div>
  </article>`;
}
function render(list){
  const shown = list.filter(p => filter === "todo" || p.cat === filter);
  $("grid").innerHTML = shown.length ? shown.map(p => card(p)).join("") : `<p class="empty">Pronto tendremos productos aquí.</p>`;
  $("countLabel").textContent = shown.length ? `${shown.length} producto${shown.length === 1 ? "" : "s"}` : "";
  document.querySelectorAll("#cats .chip").forEach(b => {
    const f = b.dataset.f;
    b.hidden = f !== "todo" && !list.some(p => p.cat === f);
    b.setAttribute("aria-pressed", f === filter ? "true" : "false");
  });
}
function renderRail(list){
  let picks = list.filter(p => p.featured && !p.sold);
  if (!picks.length) picks = list.filter(p => !p.sold).sort((a, b) => (photoURL(b) ? 1 : 0) - (photoURL(a) ? 1 : 0));
  picks = picks.slice(0, 8);
  $("destacados").hidden = !picks.length;
  $("rail").innerHTML = picks.map(p => card(p, "rail-card")).join("");
}
function renderHero(){
  if (settings.announcement) $("announceText").textContent = settings.announcement;
  $("announce").hidden = !settings.announcement;
  if (settings.heroTitle) $("heroTitle").textContent = settings.heroTitle;
  if (settings.heroText) $("heroText").textContent = settings.heroText;
  const hero = settings.heroPhoto ? photoURL({photo: settings.heroPhoto}) : "";
  const shots = products.filter(p => photoURL(p)).slice(0, 3);
  if (hero) $("heroArt").innerHTML = `<img class="hero-img" src="${esc(hero)}" alt="Productos de Mielle">`;
  else if (shots.length) $("heroArt").innerHTML = `<div class="collage n${shots.length}">${shots.map(p => `<img src="${esc(photoURL(p))}" alt="${esc(p.brand)} ${esc(p.name)}">`).join("")}</div>`;
}
document.querySelectorAll("#cats .chip").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; render(products); }));

function quickAdd(p){
  if (p.tones && p.tones.length) { openSheet(p); return; }
  addToCart(p.id, "");
  toast(`Agregado: ${p.name}`);
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
  $("sheetPhoto").innerHTML = photoURL(p) ? `<img src="${esc(photoURL(p))}" alt="${esc(p.brand)} ${esc(p.name)}">` : drawing(p, "draw");
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
  $("sheetBuy").hidden = !!p.sold; $("sheetNow").hidden = !!p.sold;
  if (p.sold) $("sheetPrice").insertAdjacentHTML("beforeend", ` <span class="badge dark">Agotado</span>`);
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
$("qPlus").onclick = () => { sheetQty = Math.min(20, sheetQty + 1); $("qVal").textContent = sheetQty; };
function addFromSheet(){
  const p = sheetProduct; if (!p) return;
  const tone = toneSel[p.id] || "";
  for (let i = 0; i < sheetQty; i++) addToCart(p.id, tone);
  toast(`Agregado: ${sheetQty > 1 ? sheetQty + " × " : ""}${p.name}${tone ? " · " + tone : ""}`);
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
function updateCount(){ $("cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0); }
function addToCart(id, tone){
  const hit = cart.find(i => i.id === id && i.tone === tone);
  if (hit) hit.qty++; else cart.push({id, tone, qty: 1});
  saveCart();
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
  const shipCost = ship && ship.cost != null ? Number(ship.cost) : null;
  return {ls, subtotal, unpriced, ship, shipCost, total: subtotal + (shipCost || 0)};
}
function totalsHTML(c, withShip){
  let h = `<div><span>Subtotal</span><span>${money(c.subtotal)}</span></div>`;
  if (withShip) h += `<div><span>Envío${c.ship ? " · " + esc(c.ship.name) : ""}</span><span>${c.shipCost == null ? "A confirmar" : c.shipCost === 0 ? "Gratis" : money(c.shipCost)}</span></div>`;
  h += `<div class="grand"><span>Total</span><span>${money(withShip ? c.total : c.subtotal)}</span></div>`;
  const notes = [];
  if (c.unpriced) notes.push("Algunos productos tienen precio por confirmar.");
  if (withShip && c.ship && c.shipCost == null) notes.push("El costo de envío te lo confirmamos por WhatsApp.");
  if (!withShip) notes.push("El envío se calcula en el siguiente paso.");
  if (notes.length) h += `<div class="note">${notes.join(" ")}</div>`;
  return h;
}

function renderCartList(){
  const c = calc();
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
  cart[i].qty += Number(b.dataset.q);
  if (cart[i].qty <= 0) cart.splice(i, 1);
  saveCart(); renderCartList(); setStep(0);
});

function fillOptions(){
  $("cProv").innerHTML = `<option value="">Elige tu provincia</option>` + PROVINCES.map(p => `<option>${esc(p)}</option>`).join("");
  $("shipOpts").innerHTML = settings.shipping.map((s, i) => `<label class="opt"><input type="radio" name="ship" value="${esc(s.id)}"><span><b>${esc(s.name)}</b>${s.note ? `<small>${esc(s.note)}</small>` : ""}</span><span class="cost">${s.cost == null || s.cost === "" ? "A cotizar" : Number(s.cost) === 0 ? "Gratis" : money(s.cost)}</span></label>`).join("");
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
  $("cart").querySelector(".drawer").scrollTop = 0;
}
function openCart(){ renderCartList(); setStep(0); $("cart").hidden = false; document.body.style.overflow = "hidden"; }
function closeCart(){
  $("cart").hidden = true; document.body.style.overflow = "";
  if (step === 4) { lastOrder = null; setStep(0); }
}
$("openCart").onclick = openCart;
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
  const c = calc(), cu = customer();
  $("vReview").innerHTML = `
    <div class="summary"><h4>Cliente</h4><span>${esc(cu.name)}</span><span>${esc(cu.phone)}</span></div>
    <div class="summary"><h4>Entrega</h4><span>${esc(cu.addr)}, ${esc(cu.city)}, ${esc(cu.prov)}</span>${cu.ref ? `<span>Ref.: ${esc(cu.ref)}</span>` : ""}<span>${esc(c.ship.name)}${c.ship.branch && cu.branch ? " · Sucursal: " + esc(cu.branch) : ""}</span></div>
    <div class="summary"><h4>Productos</h4>${c.ls.map(l => `<span>${l.qty} × ${esc(l.p.brand)} ${esc(l.p.name)}${l.tone ? " (" + esc(l.tone) + ")" : ""} — ${l.total == null ? "por confirmar" : money(l.total)}</span>`).join("")}</div>
    <div class="summary"><h4>Pago</h4><span>${esc(cu.pay)}</span>${cu.notes ? `<span>Notas: ${esc(cu.notes)}</span>` : ""}</div>
    <div class="totals">${totalsHTML(c, true)}</div>`;
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
  c.ls.forEach(l => L.push(`• ${l.qty} x ${l.p.brand} ${l.p.name}${l.tone ? " (" + l.tone + ")" : ""} — ${l.total == null ? "precio por confirmar" : money(l.total)}`));
  L.push("");
  L.push(`Subtotal: ${money(c.subtotal)}`);
  L.push(`Envío: ${c.ship.name}${c.ship.branch && cu.branch ? " · Sucursal: " + cu.branch : ""} — ${c.shipCost == null ? "a confirmar" : c.shipCost === 0 ? "gratis" : money(c.shipCost)}`);
  L.push(`*Total: ${money(c.total)}*${c.shipCost == null || c.unpriced ? " (sin incluir montos por confirmar)" : ""}`);
  L.push(`Pago: ${cu.pay}`);
  if (cu.notes) L.push(`Notas: ${cu.notes}`);
  return L.join("\n");
}

/* Invoice image drawn on a canvas, in the shop's light palette */
async function drawInvoice(o){
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
  text("MIELLE", W / 2, 150, `500 104px ${SERIF}`, C.cocoa, "center");
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
    const name = `${l.qty} × ${l.p.brand} ${l.p.name}`;
    text(fit(name, W - 2 * P - 220, `500 28px ${SANS}`), P, y, `500 28px ${SANS}`, C.ink);
    text(l.total == null ? "Por confirmar" : money(l.total), W - P, y, `500 28px ${SANS}`, C.cocoa, "right");
    const sub = [l.tone, l.p.price ? money(l.p.price) + " c/u" : ""].filter(Boolean).join(" · ");
    if (sub) text(fit(sub, W - 2 * P - 220, `400 22px ${SANS}`), P, y + 28, `400 22px ${SANS}`, C.muted);
    y += 28;
  });
  y += 30; rule(y);
  y += 50; text("Subtotal", P, y, `400 28px ${SANS}`, C.muted); text(money(c.subtotal), W - P, y, `400 28px ${SANS}`, C.ink, "right");
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
  text("@shopmielle_", W / 2, y + 44, `500 24px ${SANS}`, C.muted, "center");
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
  cart = []; saveCart();
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
  cart = local.get("mielle-cart", []).filter(i => products.some(p => p.id === i.id && !p.sold));
  render(products);
  renderRail(products);
  renderHero();
  fillOptions();
  updateCount();
})();
