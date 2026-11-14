/* CargoMatch – extra features
   1. Help assistant (FAQ chatbot, bottom right)
   2. Chat between shipper and carrier for each booking (demo: the other side replies automatically)
   3. Rating after a completed delivery
   4. Live tracking of rides on the road (simulated from departure time and driving time)
   Loaded after app.js and uses its helpers and state. */

// =====================================================================
// Shared helpers
// =====================================================================
const bookingById = (id) => state.bookings.find((b) => b.id === id);
const rideOf = (b) => b && state.rides.find((r) => r.id === b.rideId);
const timeHM = (d) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const starsText = (n) => "★".repeat(n) + "☆".repeat(5 - n);

// =====================================================================
// 2. Chat between shipper and carrier
// =====================================================================
// Messages are stored per booking as { bookingId, from: "me" | "them", text, at }.
// On your own bookings "them" is the carrier; on bookings received on your rides it is the shipper.
const messagesOf = (bookingId) => state.messages.filter((m) => m.bookingId === bookingId).sort((a, b) => a.at - b.at);
const unreadCount = (b) => messagesOf(b.id).filter((m) => m.from === "them" && m.at > (b.chatReadAt || 0)).length;

function chatButtonLabel(b, label) {
  const n = unreadCount(b);
  return `${label}${n ? ` <span class="badge" aria-label="${n} unread">${n}</span>` : ""}`;
}

function chatPartner(b) {
  const r = rideOf(b);
  return b.received ? { name: b.company, role: "Shipper", email: b.email } : { name: r.company, role: "Carrier", email: r.email };
}

let chatBookingId = null;

function openChat(bookingId) {
  const b = bookingById(bookingId);
  const r = rideOf(b);
  if (!b || !r) return;
  chatBookingId = bookingId;
  const partner = chatPartner(b);
  $("#chat-avatar").innerHTML = companyAvatar(partner.name);
  $("#chat-title").textContent = partner.name;
  $("#chat-sub").textContent = `${partner.role} · ${r.from.name} → ${r.to.name} · ${formatDate(r.date)}`;
  renderChat();
  $("#chat-dialog").showModal();
  $("#chat-form").text.focus();
}

function renderChat(typing = false) {
  const b = bookingById(chatBookingId);
  if (!b) return;
  const msgs = messagesOf(b.id);
  let lastDay = "";
  const rows = msgs.map((m) => {
    const d = new Date(m.at);
    const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const sep = day !== lastDay ? `<div class="chat-day">${day}</div>` : "";
    lastDay = day;
    return `${sep}<div class="msg ${m.from === "me" ? "msg-me" : "msg-them"}"><p>${escapeHtml(m.text)}</p><time>${timeHM(d)}</time></div>`;
  });
  $("#chat-body").innerHTML =
    `<div class="chat-note">Demo chat – replies from the other side are generated automatically.</div>` +
    (rows.length ? rows.join("") : `<div class="chat-empty">No messages yet. Say hello and agree on pick-up details.</div>`) +
    (typing ? `<div class="msg msg-them typing"><span></span><span></span><span></span></div>` : "");
  const body = $("#chat-body");
  body.scrollTop = body.scrollHeight;
  // Everything visible counts as read
  b.chatReadAt = Date.now();
  saveState();
}

// Short, context-aware demo replies
function demoReply(b, text) {
  const r = rideOf(b);
  const t = text.toLowerCase();
  const has = (...words) => words.some((w) => t.includes(w));
  const st = rideStatus(r).key;
  const unit = (n) => `${n} ${unitLabel(r.unit, n)}`;

  if (b.received) {
    // You are the carrier – the shipper answers
    if (has("time", "when", "arrive", "eta", "late", "pick")) return "Perfect, thank you. Someone from our team will be at the loading bay 30 minutes before pick-up.";
    if (has("address", "where", "gate", "depot")) return "The goods are at our warehouse – please use gate 2 and ask for the goods-in team.";
    if (has("deliver", "arrived", "signed")) return "Great news, thanks for the smooth delivery!";
    if (has("thank", "cheers", "great")) return "Thank you too – looking forward to working with you.";
    return "Thanks for the update – that works for us.";
  }

  // You are the shipper – the carrier answers
  const arr = arrivalDateTime(r);
  if (has("hello", "hi ", "hey") && t.length < 20) return "Hello! How can we help with your shipment?";
  if (has("where", "track", "eta", "late", "arrive", "when", "time")) {
    if (st === "onroad") return `We're on the road – you can follow the truck live on the ride page. Expected arrival is around ${timeHM(arr)}.`;
    if (st === "completed") return `Your goods were delivered on ${formatDate(r.date)}. Thanks again for shipping with us!`;
    return `Departure is planned for ${formatDate(r.date)} at ${r.time}, with arrival in ${r.to.name} around ${timeHM(arr)}.`;
  }
  if (has("address", "pick", "collect", "depot", "postcode")) return "Please send us the full pick-up address and a contact name – we'll pass it on to the driver.";
  if (has("tail", "lift", "forklift", "load", "heavy", "weight", "dimension")) return `Our vehicle is a ${vehicleName(r).toLowerCase()}. Let us know the weight and dimensions and we'll arrange the loading.`;
  if (has("more space", "extra", "another pallet", "more pallet")) return `Of course – there ${freeSpace(r) === 1 ? "is" : "are"} currently ${unit(freeSpace(r))} free. You can book them on the ride page.`;
  if (has("price", "cost", "invoice", "pay", "bill")) return `Your total is ${money(b.total)} for ${unit(b.amount)}. We'll send the invoice after delivery.`;
  if (has("cancel")) return "No problem – you can cancel the booking in My Bookings until departure.";
  if (has("fragile", "careful", "glass", "chilled", "fridge", "cold")) return "Noted – we'll make sure the goods are secured and handled with care.";
  if (has("thank", "cheers", "great", "perfect")) return "You're welcome! Let us know if there's anything else.";
  return "Thanks for your message – noted! We'll get back to you if anything changes.";
}

$("#chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = e.target.text;
  const text = input.value.trim();
  const b = bookingById(chatBookingId);
  if (!text || !b) return;
  input.value = "";
  state.messages.push({ id: uid(), bookingId: b.id, from: "me", text, at: Date.now() });
  saveState();
  renderChat();

  // Demo: the other side "types" and answers after a moment
  const forBooking = b.id;
  await sleep(700);
  if (chatBookingId === forBooking && $("#chat-dialog").open) renderChat(true);
  await sleep(1200 + Math.random() * 1200);
  state.messages.push({ id: uid(), bookingId: forBooking, from: "them", text: demoReply(b, text), at: Date.now() });
  saveState();
  if (chatBookingId === forBooking && $("#chat-dialog").open) renderChat();
  else toast(`New message from ${chatPartner(b).name}`);
  refreshLists();
});

$("#chat-close").addEventListener("click", () => $("#chat-dialog").close());
$("#chat-dialog").addEventListener("close", () => {
  chatBookingId = null;
  refreshLists();
});

// Re-render lists that show unread badges or ratings
function refreshLists() {
  if (!$("#view-bookings").hidden) renderBookings();
  if (!$("#view-myrides").hidden) renderMyRides();
}

// =====================================================================
// 3. Ratings after a completed delivery
// =====================================================================
let rateBookingId = null;
const rateValues = { carrier: 0, service: 0 };

function renderStars(kind) {
  const box = document.querySelector(`[data-stars="${kind}"]`);
  box.innerHTML = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<button type="button" role="radio" aria-checked="${rateValues[kind] === n}" aria-label="${n} star${n === 1 ? "" : "s"}" data-star="${n}" class="${n <= rateValues[kind] ? "on" : ""}">★</button>`
    )
    .join("") + `<span class="stars-label">${["", "Poor", "Fair", "Good", "Very good", "Excellent"][rateValues[kind]]}</span>`;
}

function openRating(bookingId) {
  const b = bookingById(bookingId);
  const r = rideOf(b);
  if (!b || !r) return;
  rateBookingId = bookingId;
  rateValues.carrier = 0;
  rateValues.service = 0;
  $("#rate-form").reset();
  $("#rate-error").textContent = "";
  $("#rate-intro").textContent = `Your shipment ${r.from.name} → ${r.to.name} on ${formatDate(r.date)} has been delivered.`;
  $("#rate-carrier-name").textContent = r.company;
  renderStars("carrier");
  renderStars("service");
  $("#rate-dialog").showModal();
}

document.querySelectorAll("[data-stars]").forEach((box) =>
  box.addEventListener("click", (e) => {
    const star = e.target.closest("[data-star]");
    if (!star) return;
    rateValues[box.dataset.stars] = Number(star.dataset.star);
    renderStars(box.dataset.stars);
  })
);

$("#rate-cancel").addEventListener("click", () => $("#rate-dialog").close());
$("#rate-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const b = bookingById(rateBookingId);
  if (!b) return;
  if (!rateValues.carrier || !rateValues.service) {
    $("#rate-error").textContent = "Please give a star rating for both the carrier and our service.";
    return;
  }
  b.rating = {
    carrier: rateValues.carrier,
    service: rateValues.service,
    carrierComment: e.target.carrierComment.value.trim(),
    improve: e.target.improve.value.trim(),
    at: Date.now(),
  };
  saveState();
  $("#rate-dialog").close();
  toast("Thank you for your feedback!");
  refreshLists();
});

// =====================================================================
// My Bookings: actions per booking + rating prompt
// =====================================================================
function bookingActions(b, r) {
  const st = rideStatus(r).key;
  const out = [`<button type="button" class="btn btn-ghost btn-sm" data-chat="${b.id}">${chatButtonLabel(b, "Message carrier")}</button>`];
  if (st === "onroad") out.push(`<a href="#/ride/${r.id}" class="btn btn-sm btn-live" data-track="${r.id}"><span class="live-dot"></span>Track live</a>`);
  if (st === "completed") {
    out.push(
      b.rating
        ? `<span class="rated" title="Your rating">You rated: <span class="rated-stars">${starsText(b.rating.carrier)}</span></span>`
        : `<button type="button" class="btn btn-primary btn-sm" data-rate="${b.id}">★ Rate delivery</button>`
    );
  }
  if (!["onroad", "completed", "cancelled"].includes(st)) out.push(`<button type="button" class="btn btn-ghost btn-sm btn-danger" data-cancel="${b.id}">Cancel booking</button>`);
  return `<div class="booking-actions">${out.join("")}</div>`;
}

// Wrap the original renderer to add a prompt for deliveries waiting for a rating
const renderBookingsBase = renderBookings;
renderBookings = function () {
  renderBookingsBase();
  let banner = $("#rate-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "rate-banner";
    $("#booking-list").before(banner);
  }
  const pending = myBookings().filter((b) => !b.rating && rideStatus(rideOf(b)).key === "completed");
  if (!pending.length) {
    banner.innerHTML = "";
    return;
  }
  const r = rideOf(pending[0]);
  banner.innerHTML = `
    <div class="rate-banner card">
      <span class="rate-banner-stars" aria-hidden="true">★★★★★</span>
      <div><strong>Your delivery ${escapeHtml(r.from.name)} → ${escapeHtml(r.to.name)} is complete.</strong>
      <span>How did it go? Rate ${escapeHtml(r.company)} and tell us what we could improve.</span></div>
      <button type="button" class="btn btn-primary btn-sm" data-rate="${pending[0].id}">Rate now</button>
    </div>`;
};

// One click handler for chat, rating and tracking buttons anywhere on the page
document.addEventListener("click", (e) => {
  const chat = e.target.closest("[data-chat]");
  if (chat) {
    e.preventDefault();
    openChat(chat.dataset.chat);
    return;
  }
  const rate = e.target.closest("[data-rate]");
  if (rate) {
    e.preventDefault();
    openRating(rate.dataset.rate);
    return;
  }
  const track = e.target.closest("[data-track]");
  if (track) {
    e.preventDefault();
    openRide(track.dataset.track);
  }
});

// =====================================================================
// 4. Live tracking (simulated position along the real road route)
// =====================================================================
let trackRide = null;
let trackTimer = null;
let trackMarker = null;
let timelapse = null; // { start, duration, raf }

const truckIcon = L.divIcon({
  className: "",
  html: `<div class="truck-marker"><span class="truck-pulse"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function trackPanel() {
  let panel = $("#track-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "track-panel";
    panel.className = "track-panel";
    $("#ride-route-info").before(panel);
    panel.addEventListener("click", (e) => {
      if (e.target.closest("[data-timelapse]")) toggleTimelapse();
      if (e.target.closest("[data-centre]") && trackMarker) rideMap.map.setView(trackMarker.getLatLng(), Math.max(rideMap.map.getZoom(), 8));
    });
  }
  return panel;
}

// Share of the journey completed at time t (0 … 1)
function journeyProgress(r, t) {
  const dep = departureDate(r).getTime();
  const arr = arrivalDateTime(r).getTime();
  return Math.min(1, Math.max(0, (t - dep) / (arr - dep)));
}

// Point at fraction f of a polyline, measured by distance
function pointAlong(coords, f) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = distanceMiles({ lat: coords[i - 1][0], lng: coords[i - 1][1] }, { lat: coords[i][0], lng: coords[i][1] });
    seg.push(d);
    total += d;
  }
  let target = total * f;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const k = seg[i] ? Math.min(1, target / seg[i]) : 0;
      const [a, b] = [coords[i], coords[i + 1]];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    target -= seg[i];
  }
  return coords[coords.length - 1];
}

function nearestCity(lat, lng) {
  let best = null;
  let bestD = Infinity;
  for (const c of UK_CITIES) {
    const d = distanceMiles({ lat, lng }, c);
    if (d < bestD) [best, bestD] = [c, d];
  }
  return { city: best, miles: bestD };
}

function updateTruck() {
  const r = trackRide;
  if (!r || !rideMap || !rideMap.map || !rideMap.coords) return;
  const dep = departureDate(r).getTime();
  const arr = arrivalDateTime(r).getTime();
  let f;
  let simTime;
  if (timelapse) {
    f = Math.min(1, (performance.now() - timelapse.start) / timelapse.duration);
    simTime = dep + f * (arr - dep);
  } else {
    simTime = Date.now();
    f = journeyProgress(r, simTime);
  }
  const [lat, lng] = pointAlong(rideMap.coords, f);
  const tip = `${escapeHtml(r.company)} · ${Math.round(f * 100)}% of the route`;
  if (!trackMarker) {
    trackMarker = L.marker([lat, lng], { icon: truckIcon, zIndexOffset: 1000, keyboard: false }).addTo(rideMap.map);
    trackMarker.bindTooltip(tip, { direction: "top", offset: [0, -16] });
  } else {
    trackMarker.setLatLng([lat, lng]);
    trackMarker.setTooltipContent(tip);
  }

  const info = routeInfo(r.from, r.to);
  const left = Math.max(0, Math.round(info.miles * (1 - f)));
  const near = nearestCity(lat, lng);
  const where = near.miles < 12 ? `near ${near.city.name}` : `${Math.round(near.miles)} mi from ${near.city.name}`;
  const done = f >= 1;
  const mode = timelapse ? "Demo replay" : done ? "Delivered" : "Live";

  trackPanel().innerHTML = `
    <div class="track-top">
      <span class="track-badge ${timelapse ? "replay" : done ? "done" : "live"}">${!done || timelapse ? '<span class="live-dot"></span>' : "✓ "}${mode}</span>
      <span class="track-where">${done && !timelapse ? `Arrived in ${escapeHtml(r.to.name)}` : `Truck is ${where}`}</span>
      <span class="track-clock">${timelapse ? `Simulated time ${timeHM(new Date(simTime))}` : `Updated ${timeHM(new Date())}`}</span>
    </div>
    <div class="track-progress"><span style="width:${(f * 100).toFixed(1)}%"></span></div>
    <div class="track-stats">
      <div><span>Progress</span><strong>${Math.round(f * 100)}%</strong></div>
      <div><span>Distance left</span><strong>${left} mi</strong></div>
      <div><span>${done ? "Arrived" : "ETA"}</span><strong>${timeHM(new Date(arr))}</strong></div>
    </div>
    <div class="track-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-centre>Centre on truck</button>
      <button type="button" class="btn btn-primary btn-sm" data-timelapse>${timelapse ? "■ Stop replay" : "▶ Play journey in 30 s (demo)"}</button>
    </div>
    <p class="track-note">Position simulated from departure time and estimated driving time along the road route – no real GPS in this prototype.</p>`;

  if (timelapse && f >= 1) stopTimelapse();
}

function toggleTimelapse() {
  if (timelapse) return stopTimelapse();
  timelapse = { start: performance.now(), duration: 30000 };
  const step = () => {
    if (!timelapse) return;
    updateTruck();
    if (timelapse) timelapse.raf = requestAnimationFrame(step);
  };
  timelapse.raf = requestAnimationFrame(step);
}

function stopTimelapse() {
  if (timelapse) cancelAnimationFrame(timelapse.raf);
  timelapse = null;
  updateTruck();
}

function startTracking(r) {
  stopTracking();
  const st = rideStatus(r).key;
  if (st !== "onroad" && st !== "completed") return;
  trackRide = r;
  trackPanel().hidden = false;
  rideMap.onDraw = updateTruck; // re-place the truck once the road geometry has loaded
  updateTruck();
  if (st === "onroad") trackTimer = setInterval(() => !timelapse && updateTruck(), 5000);
}

function stopTracking() {
  clearInterval(trackTimer);
  trackTimer = null;
  if (timelapse) cancelAnimationFrame(timelapse.raf);
  timelapse = null;
  if (trackMarker) trackMarker.remove();
  trackMarker = null;
  trackRide = null;
  if (typeof rideMap !== "undefined" && rideMap) rideMap.onDraw = null;
  const panel = $("#track-panel");
  if (panel) panel.hidden = true;
}

// =====================================================================
// 1. Help assistant (FAQ chatbot)
// =====================================================================
// Answers come from this fixed knowledge base; the best keyword match wins.
const FAQ = [
  { id: "what", q: "What is CargoMatch?", keys: ["what is", "about", "cargomatch", "how does it work", "idea", "explain"],
    a: "CargoMatch connects businesses whose lorries drive a route with free space to businesses that need to ship goods along the same route. Carriers earn on empty miles, shippers pay only for the space they need." },
  { id: "offer", q: "How do I offer a ride?", keys: ["offer", "publish", "post a", "list a", "empty truck", "empty space", "free space", "carrier"],
    a: 'Go to <a href="#/offer">Offer a Ride</a>, enter your company, the route, departure time, vehicle type, free space and your price per quantity. After publishing, you can follow bookings and status under <a href="#/myrides">My Rides</a>.' },
  { id: "book", q: "How do I book space?", keys: ["book", "reserve", "find a ride", "search", "ship", "send goods", "shipper"],
    a: 'Open <a href="#/find">Find a Ride</a>, search by town or postcode, choose a ride and enter the amount you want to ship. The total price is calculated before you confirm.' },
  { id: "price", q: "How are prices set?", keys: ["price", "cost", "fee", "pay", "payment", "invoice", "how much", "charge", "commission", "expensive", "cheap"],
    a: "Each carrier sets their own price per pallet, m³ or kg. You see the total before booking. In this prototype CargoMatch charges no fees – payment is arranged directly between you and the carrier." },
  { id: "cancel", q: "Can I cancel a booking?", keys: ["cancel", "cancel my", "cancel a", "cancel the", "refund", "withdraw", "change my booking"],
    a: 'Shippers can cancel a booking in <a href="#/bookings">My Bookings</a> until the lorry departs. Carriers can withdraw a ride in <a href="#/myrides">My Rides</a> – please message shippers who already booked.' },
  { id: "track", q: "How can I track my shipment?", keys: ["track", "tracking", "where is", "where's", "location", "live", "eta", "gps", "map", "my shipment", "where are my goods", "my delivery", "arrive", "late"],
    a: 'As soon as the lorry is on the road, click <strong>Track live</strong> in <a href="#/bookings">My Bookings</a>. The map shows where the truck is, the distance left and the expected arrival. (In this prototype the position is simulated.)' },
  { id: "chat", q: "How do I contact the carrier?", keys: ["contact", "message", "chat", "talk", "phone", "email", "reach", "speak"],
    a: 'After booking, use <strong>Message carrier</strong> in <a href="#/bookings">My Bookings</a> to agree pick-up details. Carriers can reply to shippers from <a href="#/myrides">My Rides</a>.' },
  { id: "rate", q: "How do ratings work?", keys: ["rate", "rating", "review", "feedback", "star", "complain", "improve"],
    a: "When a delivery is complete you are asked to rate the carrier and our service – and you can tell us what we could improve. The number of successful trips is shown on every carrier." },
  { id: "vehicles", q: "Which vehicles and units are supported?", keys: ["vehicle", "lorry", "truck", "van", "capacity", "pallet", "weight", "unit", "size", "m3", "m³", "kg"],
    a: "Three vehicle types: articulated lorries (up to 44 t), rigid trucks (18–26 t) and 7.5 t trucks. Space can be offered in pallets, cubic metres (m³) or kilograms." },
  { id: "co2", q: "How does CargoMatch help the climate?", keys: ["co2", "co₂", "carbon", "emission", "sustainab", "environment", "green", "climate"],
    a: 'Around 30% of lorry kilometres in the UK are driven empty. Every shipment that rides along on an existing trip replaces a separate journey – each ride shows the estimated CO₂e saved. More on our <a href="#/sustainability">Sustainability page</a>.' },
  { id: "area", q: "Where does CargoMatch operate?", keys: ["area", "uk", "britain", "england", "scotland", "wales", "northern ireland", "ireland", "europe", "abroad", "international", "country"],
    a: "CargoMatch works within the United Kingdom only: England, Scotland, Wales and Northern Ireland. International routes are not supported." },
  { id: "account", q: "Do I need an account?", keys: ["account", "login", "log in", "sign up", "register", "password", "profile"],
    a: "Not in this prototype – there are no user accounts yet. Your rides and bookings are saved in your browser on this device." },
  { id: "insurance", q: "Are my goods insured?", keys: ["insurance", "insured", "goods insured", "damage", "lost", "broken", "liability", "theft"],
    a: "CargoMatch does not provide insurance in this prototype. Please check the carrier's goods-in-transit cover via the chat before you ship." },
  { id: "special", q: "Can I ship chilled or fragile goods?", keys: ["hazardous", "dangerous", "adr", "chemical", "chilled", "refrigerated", "frozen", "fragile", "food"],
    a: "Check the notes on each ride – some carriers offer refrigerated or careful handling. If in doubt, message the carrier before booking. Hazardous goods are only allowed where the carrier says so." },
  { id: "hello", q: null, keys: ["hello", "hi", "hey", "good morning", "good afternoon"], a: "Hello! 👋 What would you like to know about CargoMatch?" },
  { id: "thanks", q: null, keys: ["thank", "thanks", "cheers", "great", "perfect"], a: "You're welcome! Anything else I can help with?" },
];
const SUGGESTED = ["what", "book", "offer", "price", "track", "co2"];

function faqAnswer(text) {
  const t = ` ${text.toLowerCase()} `;
  let best = null;
  let bestScore = 0;
  for (const entry of FAQ) {
    // Short keys must match a whole word, longer ones may match inside a word
    const score = entry.keys.reduce((s, k) => s + (k.length <= 3 ? (new RegExp(`\\b${k}\\b`).test(t) ? 1 : 0) : t.includes(k) ? k.split(" ").length : 0), 0);
    if (score > bestScore) [best, bestScore] = [entry, score];
  }
  return best;
}

const assistantBody = $("#assistant-body");

function addAssistantMsg(html, who = "bot", chips = null) {
  const div = document.createElement("div");
  div.className = `msg ${who === "me" ? "msg-me" : "msg-them"}`;
  div.innerHTML = `<p>${html}</p>`;
  assistantBody.append(div);
  if (chips) {
    const row = document.createElement("div");
    row.className = "chips";
    row.innerHTML = chips
      .map((id) => FAQ.find((f) => f.id === id))
      .filter((f) => f && f.q)
      .map((f) => `<button type="button" class="chip" data-faq="${f.id}">${f.q}</button>`)
      .join("");
    assistantBody.append(row);
  }
  assistantBody.scrollTop = assistantBody.scrollHeight;
}

async function askAssistant(text) {
  addAssistantMsg(escapeHtml(text), "me");
  const typing = document.createElement("div");
  typing.className = "msg msg-them typing";
  typing.innerHTML = "<span></span><span></span><span></span>";
  assistantBody.append(typing);
  assistantBody.scrollTop = assistantBody.scrollHeight;
  await sleep(500 + Math.random() * 400);
  typing.remove();
  const hit = faqAnswer(text);
  if (hit) addAssistantMsg(hit.a, "bot", hit.q ? null : SUGGESTED);
  else
    addAssistantMsg(
      "Sorry, I don't have an answer to that yet. Here are some topics I can help with – or message your carrier directly from My Bookings.",
      "bot",
      FAQ.filter((f) => f.q).map((f) => f.id)
    );
}

function setAssistantOpen(open) {
  $("#assistant-panel").hidden = !open;
  $("#assistant").classList.toggle("open", open);
  $("#assistant-toggle").setAttribute("aria-expanded", String(open));
  $("#assistant-toggle").setAttribute("aria-label", open ? "Close help assistant" : "Open help assistant");
  if (open) {
    if (!assistantBody.children.length) addAssistantMsg("Hi! I'm the CargoMatch assistant. Ask me anything about offering or booking rides – or pick a topic:", "bot", SUGGESTED);
    $("#assistant-form").text.focus();
  }
}

$("#assistant-toggle").addEventListener("click", () => setAssistantOpen($("#assistant-panel").hidden));
$("#assistant-close").addEventListener("click", () => setAssistantOpen(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#assistant-panel").hidden && !document.querySelector("dialog[open]")) setAssistantOpen(false);
});
$("#assistant-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = e.target.text.value.trim();
  if (!text) return;
  e.target.text.value = "";
  askAssistant(text);
});
assistantBody.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-faq]");
  if (!chip) return;
  const f = FAQ.find((x) => x.id === chip.dataset.faq);
  if (f) askAssistant(f.q);
});

// For you as a shipper, a ride that hasn't left yet is simply "Upcoming"
function bookingStatusPill(r) {
  const st = rideStatus(r);
  if (["open", "booking", "full"].includes(st.key)) return `<span class="status-pill st-open">Upcoming</span>`;
  return statusPill(r);
}
