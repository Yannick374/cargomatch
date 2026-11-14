/* CargoMatch – prototype marketplace for empty truck space in the UK.
   All data lives in localStorage (no backend yet). */

const STORE_KEY = "cargomatch.v1";
const ROUTE_CACHE_KEY = "cargomatch.routes.v2";
const UK_BOUNDS = L.latLngBounds([49.8, -8.7], [60.9, 1.9]);

// OSRM returns car driving times. HGVs are speed-limited (56 mph governor,
// 50 mph on dual carriageways), so we scale car times up for a realistic truck estimate.
const HGV_TIME_FACTOR = 1.2;
const HGV_AVG_MPH = 45; // fallback when the routing service is unavailable

// ---------- State ----------
const state = loadState();

// Places are stored as { name, region, lat, lng }. Older data stored plain city names.
function toPlace(p) {
  return typeof p === "string" ? cityPlace(p) : p;
}

function loadState() {
  let s = null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) s = JSON.parse(raw);
  } catch (e) { /* storage unavailable – fall back to seed */ }
  const SEED_VERSION = 5;
  const seed = () => buildSeedRides().map((r) => ({ ...r, id: uid(), booked: r.booked || 0, createdAt: Date.now() }));
  if (!s) s = { rides: [], bookings: [], seedVersion: 1 };
  // Add demo rides introduced in later versions to data saved by an earlier version.
  // A ride is identified by carrier + start + destination, so existing rides are never duplicated.
  if ((s.seedVersion || 1) < SEED_VERSION) {
    const placeName = (p) => (typeof p === "string" ? p : p && p.name);
    const rideKey = (r) => `${r.email}|${placeName(r.from)}|${placeName(r.to)}`;
    const known = new Set(s.rides.map(rideKey));
    s.rides.push(...seed().filter((r) => !known.has(rideKey(r))));
    // Demo rides of your own company, together with the bookings they received
    for (const demo of buildOwnDemoRides()) {
      if (known.has(rideKey(demo))) continue;
      const { bookings, ...ride } = demo;
      const id = uid();
      const created = new Date(`${ride.date}T00:00`).getTime() - 5 * 86400000;
      s.rides.push({ ...ride, id, own: true, booked: bookings.reduce((n, b) => n + b.amount, 0), createdAt: created });
      bookings.forEach((b, i) =>
        s.bookings.push({ ...b, id: uid(), rideId: id, total: (ride.price / ride.priceQty) * b.amount, received: true, createdAt: created + (i + 1) * 3600000 })
      );
    }
    // Demo bookings you made as a shipper, with their chat history
    s.messages = s.messages || [];
    for (const demo of buildMyDemoBookings()) {
      let ride;
      if (demo.ride) {
        const { otherBooked, ...r } = demo.ride;
        if (known.has(rideKey(r))) continue;
        ride = { ...r, id: uid(), booked: otherBooked, createdAt: new Date(`${r.date}T00:00`).getTime() - 4 * 86400000 };
        s.rides.push(ride);
      } else {
        const ref = demo.rideRef;
        ride = s.rides.find((r) => r.email === ref.email && placeName(r.from) === ref.from && placeName(r.to) === ref.to);
        if (!ride || ride.capacity - ride.booked < demo.booking.amount) continue;
        if (s.bookings.some((b) => b.rideId === ride.id && b.email === demo.booking.email)) continue;
      }
      const b = demo.booking;
      const firstMsg = Math.max(...demo.messages.map((m) => m.ago), 60);
      const booking = { ...b, id: uid(), rideId: ride.id, total: (ride.price / ride.priceQty) * b.amount, createdAt: Date.now() - (firstMsg + 30) * 60000 };
      ride.booked += b.amount;
      s.bookings.push(booking);
      demo.messages.forEach((m) => s.messages.push({ id: uid(), bookingId: booking.id, from: m.from, text: m.text, at: Date.now() - m.ago * 60000 }));
    }
    s.seedVersion = SEED_VERSION;
    // Persist immediately so the new rides keep stable IDs (and links) across reloads
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }
  s.messages = s.messages || [];
  s.rides = s.rides
    .map((r) => {
      const v = { ...r, ...(LEGACY_VEHICLES[r.vehicle] || {}), from: toPlace(r.from), to: toPlace(r.to) };
      if (VEHICLE_RENAMES[v.vehicle]) v.vehicle = VEHICLE_RENAMES[v.vehicle];
      if (COMPANY_RENAMES[v.email]) v.company = COMPANY_RENAMES[v.email];
      return v;
    })
    .filter((r) => r.from && r.to);
  return s;
}

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const money = (n) => "£" + Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unitLabel = (unit, n = 1) => (unit === "pallet" ? (n === 1 ? "pallet" : "pallets") : unit);
const freeSpace = (r) => r.capacity - r.booked;
const today = () => new Date().toISOString().slice(0, 10);

function formatDate(iso) {
  return new Date(iso + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(min) {
  const m = Math.round(min / 5) * 5;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} min`;
  return rest ? `${h} h ${String(rest).padStart(2, "0")} min` : `${h} h`;
}

// Arrival = departure + driving time (+ 45 min break per 4.5 h, as required for HGV drivers)
function arrivalTime(time, driveMin) {
  const breaks = Math.floor(driveMin / 270) * 45;
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + Math.round(driveMin) + breaks;
  const days = Math.floor(total / 1440);
  const t = total % 1440;
  const hhmm = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  return days ? `${hhmm} (+${days} day${days > 1 ? "s" : ""})` : hhmm;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3000);
}

// ---------- Place lookup (free text → UK location) ----------
// Uses OpenStreetMap Nominatim, restricted to the United Kingdom (countrycodes=gb).
const GEO_CACHE_KEY = "cargomatch.geo.v1";
const geoCache = (() => {
  try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY)) || {}; } catch (e) { return {}; }
})();

// Resolves to a place, or null if nothing was found in the UK. Rejects if the service is unreachable.
async function geocode(query) {
  const q = query.trim();
  if (!q) return null;
  const key = q.toLowerCase();
  if (geoCache[key]) return geoCache[key];

  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=gb&limit=1&addressdetails=1&accept-language=en-GB&q=" +
    encodeURIComponent(q);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Lookup failed");
  const [r] = await res.json();
  if (!r) return null;

  const a = r.address || {};
  const town = a.city || a.town || a.village || a.hamlet || a.suburb;
  let name = r.name || r.display_name.split(",")[0];
  if (town && town !== name) name = `${name}, ${town}`;
  const place = { name, region: a.state_district || a.county || a.state || "", lat: Number(r.lat), lng: Number(r.lon) };

  geoCache[key] = place;
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geoCache)); } catch (e) { /* ignore */ }
  return place;
}

const placeText = (p) => (p.region ? `${p.name} · ${p.region}` : p.name);

// ---------- Live place suggestions while typing ----------
// Photon (komoot, OpenStreetMap data) is built for search-as-you-type; results are limited to the UK.
const PLACE_TYPES = ["city", "town", "village", "hamlet", "suburb", "district", "locality", "postcode", "county"];

function photonToPlace(f) {
  const p = f.properties;
  const town = p.city || p.town || p.village;
  let name = p.name || p.street || "";
  if (town && town !== name) name = `${name}, ${town}`;
  return {
    name,
    region: p.county || p.state || "",
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    kind: p.osm_value === "postcode" || p.type === "postcode" ? "postcode" : PLACE_TYPES.includes(p.type) || PLACE_TYPES.includes(p.osm_value) ? "place" : "poi",
  };
}

async function suggestPlaces(query) {
  const url = "https://photon.komoot.io/api/?limit=12&lang=en&bbox=-8.7,49.8,1.9,60.9&q=" + encodeURIComponent(query);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Suggestions failed");
  const data = await res.json();
  const rank = { place: 0, postcode: 1, poi: 2 };
  const seen = new Set();
  return data.features
    .filter((f) => f.properties.countrycode === "GB" && f.properties.name)
    .map(photonToPlace)
    .sort((a, b) => rank[a.kind] - rank[b.kind])
    .filter((p) => {
      const key = `${p.name}|${p.region}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// Instant matches from the built-in city list while the network request runs
function localSuggestions(query) {
  const q = query.toLowerCase();
  return UK_CITIES.filter((c) => c.name.toLowerCase().startsWith(q))
    .slice(0, 4)
    .map((c) => ({ name: c.name, region: c.region, lat: c.lat, lng: c.lng, kind: "place" }));
}

const SUGGEST_ICONS = {
  place: `<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>`,
  postcode: `<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h6M7 14h10"/>`,
  poi: `<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>`,
};

function highlightMatch(text, query) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0 || !query) return escapeHtml(text);
  return escapeHtml(text.slice(0, i)) + "<mark>" + escapeHtml(text.slice(i, i + query.length)) + "</mark>" + escapeHtml(text.slice(i + query.length));
}

function attachAutocomplete(input, onSelect) {
  const list = document.createElement("ul");
  list.className = "suggest";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  input.parentElement.classList.add("suggest-host");
  input.insertAdjacentElement("afterend", list);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");

  let items = [];
  let active = -1;
  let seq = 0;
  let timer;

  const close = () => {
    list.hidden = true;
    active = -1;
    input.setAttribute("aria-expanded", "false");
  };

  const render = (query, loading) => {
    if (!items.length && !loading) {
      list.innerHTML = `<li class="suggest-empty">No places found in the UK</li>`;
    } else {
      list.innerHTML =
        items
          .map(
            (p, i) => `
          <li role="option" data-i="${i}" class="${i === active ? "active" : ""}" aria-selected="${i === active}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SUGGEST_ICONS[p.kind] || SUGGEST_ICONS.place}</svg>
            <span><strong>${highlightMatch(p.name, query)}</strong>${p.region ? `<small>${escapeHtml(p.region)}</small>` : ""}</span>
          </li>`
          )
          .join("") + (loading ? `<li class="suggest-loading">Searching…</li>` : "");
    }
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };

  const choose = (i) => {
    const place = items[i];
    if (!place) return;
    input.value = place.name;
    // Remember the exact coordinates so a later lookup of this text needs no request
    geoCache[place.name.toLowerCase()] = { name: place.name, region: place.region, lat: place.lat, lng: place.lng };
    close();
    onSelect({ name: place.name, region: place.region, lat: place.lat, lng: place.lng });
  };

  input.addEventListener("input", () => {
    const query = input.value.trim();
    clearTimeout(timer);
    const mySeq = ++seq;
    if (query.length < 2) return close();
    items = localSuggestions(query);
    active = -1;
    render(query, true);
    timer = setTimeout(async () => {
      try {
        const remote = await suggestPlaces(query);
        if (mySeq !== seq) return;
        const seen = new Set(items.map((p) => p.name.toLowerCase()));
        items = [...items, ...remote.filter((p) => !seen.has(p.name.toLowerCase()))].slice(0, 7);
      } catch (e) {
        if (mySeq !== seq) return;
      }
      if (document.activeElement === input) render(query, false);
    }, 220);
  });

  input.addEventListener("keydown", (e) => {
    if (list.hidden || !items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      render(input.value.trim(), false);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      close();
    }
  });

  // mousedown (not click) so the input keeps focus and the choice wins over blur
  list.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const li = e.target.closest("li[data-i]");
    if (li) choose(Number(li.dataset.i));
  });
  input.addEventListener("blur", () => setTimeout(close, 100));
}

// ---------- Vehicles ----------
const VEHICLE_ICONS = {
  artic: `<rect x="2" y="6" width="37" height="15" rx="1.5"/><path d="M42 21V10h9l6 6v5z"/><path d="M51 10v6h6"/><circle cx="10" cy="24" r="3"/><circle cx="18" cy="24" r="3"/><circle cx="33" cy="24" r="3"/><circle cx="50" cy="24" r="3"/>`,
  rigid: `<rect x="5" y="6" width="31" height="15" rx="1.5"/><path d="M38 21V10h9l6 6v5z"/><path d="M47 10v6h6"/><circle cx="14" cy="24" r="3"/><circle cx="27" cy="24" r="3"/><circle cx="46" cy="24" r="3"/>`,
  truck75: `<rect x="10" y="9" width="23" height="12" rx="1.5"/><path d="M35 21v-9h7l5 5v4z"/><circle cx="18" cy="24" r="3"/><circle cx="41" cy="24" r="3"/>`,
  van: `<path d="M9 21V12a3 3 0 0 1 3-3h22l8 6h7a2 2 0 0 1 2 2v4z"/><path d="M34 9v6h8"/><circle cx="17" cy="24" r="3"/><circle cx="43" cy="24" r="3"/>`,
};
const vehicleIcon = (key) =>
  `<svg class="vehicle-icon" viewBox="0 0 60 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">${VEHICLE_ICONS[key] || VEHICLE_ICONS.artic}</svg>`;
const vehicleName = (r) => (VEHICLE_TYPES[r.vehicle] || { label: r.vehicle || "Vehicle" }).label;
const vehicleText = (r) => vehicleName(r);

// ---------- Carrier track record ----------
// Completed = trips from the demo history plus this carrier's past rides in the app that carried goods
function carrierStats(email) {
  const key = String(email || "").toLowerCase();
  const history = CARRIER_HISTORY[key] || { completed: 0, since: null };
  const own = state.rides.filter((r) => r.email.toLowerCase() === key);
  const completedHere = own.filter((r) => r.date < today() && r.booked > 0).length;
  const firstListed = own.reduce((min, r) => Math.min(min, r.createdAt || Infinity), Infinity);
  const since = history.since || (isFinite(firstListed) ? new Date(firstListed).toISOString().slice(0, 10) : today());
  return { completed: history.completed + completedHere, since, upcoming: own.filter((r) => r.date >= today()).length };
}

// ---------- Company badge (initials in a colour derived from the name) ----------
const AVATAR_COLOURS = ["#4f6bff", "#7c3aed", "#0d9488", "#d97706", "#db2777", "#2563eb", "#059669", "#9333ea", "#ea580c", "#0891b2"];
function companyInitials(name) {
  const words = String(name).replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/)
    .filter((w) => w && !/^(ltd|plc|co|llp|limited|the|and)$/i.test(w));
  return ((words[0] || "?")[0] + (words[1] ? words[1][0] : "")).toUpperCase();
}
function companyColour(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}
const companyAvatar = (name, size = "") =>
  `<span class="avatar ${size}" style="--av:${companyColour(name)}" aria-hidden="true">${escapeHtml(companyInitials(name))}</span>`;

// Header row naming the carrier, used on ride cards and the ride page
const carrierRow = (r, label = "Offered by") => `
  <div class="ride-carrier">
    ${companyAvatar(r.company)}
    <div class="ride-carrier-name"><span>${label}</span><strong>${escapeHtml(r.company)}</strong></div>
    ${tripsBadge(r.email)}
  </div>`;

function tripsBadge(email) {
  const { completed } = carrierStats(email);
  if (!completed) return `<span class="trips-badge new">New carrier</span>`;
  return `<span class="trips-badge${completed >= 50 ? " trusted" : ""}" title="Trips successfully completed via CargoMatch">✓ ${completed} trip${completed === 1 ? "" : "s"}</span>`;
}

// ---------- Routing (distance, driving time, road geometry) ----------
// Distance/time are cached in localStorage; road geometry only in memory.
const routeStats = (() => {
  try { return JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY)) || {}; } catch (e) { return {}; }
})();
const routeGeometry = {};
const routeRequests = {};
const coordKey = (p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
const routeKey = (from, to) => `${coordKey(from)}|${coordKey(to)}`;

function distanceMiles(a, b) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Best info we currently have for a route (real if fetched, otherwise an estimate)
function routeInfo(from, to) {
  const cached = routeStats[routeKey(from, to)];
  if (cached) return { ...cached, coords: routeGeometry[routeKey(from, to)] || null, estimated: false };
  const miles = distanceMiles(from, to) * 1.2;
  return { miles, minutes: (miles / HGV_AVG_MPH) * 60, coords: null, estimated: true };
}

function fetchRoute(from, to) {
  const key = routeKey(from, to);
  if (routeGeometry[key]) return Promise.resolve(routeInfo(from, to));
  if (routeRequests[key]) return routeRequests[key];
  const a = from;
  const b = to;
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  routeRequests[key] = fetch(url)
    .then((res) => res.json())
    .then((data) => {
      const r = data.routes && data.routes[0];
      if (data.code !== "Ok" || !r) throw new Error("No route");
      routeGeometry[key] = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      routeStats[key] = { miles: r.distance / 1609.34, minutes: (r.duration / 60) * HGV_TIME_FACTOR };
      try { localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(routeStats)); } catch (e) { /* ignore */ }
      return routeInfo(from, to);
    })
    .catch(() => routeInfo(from, to))
    .finally(() => delete routeRequests[key]);
  return routeRequests[key];
}

// ---------- CO2 estimate ----------
// One shipment on an existing ride replaces one separate trip of the same distance.
// Conservative factor: smallest lorry class at 0% load (DESNZ 2025) = 0.74 kg CO2e per mile.
const SEPARATE_TRIP_KG_PER_MILE = 0.74;
const leafIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>`;
const co2Saved = (ride) => Math.round(routeInfo(ride.from, ride.to).miles * SEPARATE_TRIP_KG_PER_MILE);
const fmtKg = (kg) => (kg >= 1000 ? `${(kg / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} t` : `${kg.toLocaleString("en-GB")} kg`);
const ecoLabel = (ride) => `${leafIcon}<span>~${fmtKg(co2Saved(ride))} CO₂e saved per shipment</span>`;

function driveSummary(ride) {
  const info = routeInfo(ride.from, ride.to);
  return `~${Math.round(info.miles)} mi · ${formatDuration(info.minutes)} drive · arr. ${arrivalTime(ride.time, info.minutes)}`;
}

// ---------- Route map (hidden until a route is chosen; shows only that route) ----------
const pinIcon = (cls) =>
  L.divIcon({ className: "", html: `<span class="pin ${cls}"></span>`, iconSize: [16, 16], iconAnchor: [8, 8] });

class RouteMap {
  constructor(prefix) {
    this.mapEl = $(`#${prefix}-map`);
    this.emptyEl = $(`#${prefix}-map-empty`);
    this.infoEl = $(`#${prefix}-route-info`);
    this.map = null;
    this.token = 0;
    this.current = null;
  }

  hide() {
    this.token++;
    this.current = null;
    this.mapEl.hidden = true;
    this.infoEl.hidden = true;
    this.emptyEl.hidden = false;
  }

  // ride: { from, to, time }
  async show(ride) {
    const token = ++this.token;
    const key = routeKey(ride.from, ride.to) + ride.time;
    const same = this.current === key;
    this.current = key;
    this.emptyEl.hidden = true;
    this.mapEl.hidden = false;
    this.infoEl.hidden = false;

    if (!this.map) {
      // Zoom only via the +/− buttons: no scroll/trackpad, pinch, double-click or shift-drag zoom
      this.map = L.map(this.mapEl, {
        zoomSnap: 0.25,
        attributionControl: true,
        scrollWheelZoom: false,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      });
      // A trackpad pinch arrives as ctrl+wheel; stop it from zooming the whole page instead
      this.mapEl.addEventListener("wheel", (e) => e.ctrlKey && e.preventDefault(), { passive: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(this.map);
      this.layer = L.layerGroup().addTo(this.map);
    }
    this.map.invalidateSize();

    let info = routeInfo(ride.from, ride.to);
    if (!same || info.coords) this.draw(ride, info);
    if (!info.coords) {
      info = await fetchRoute(ride.from, ride.to);
      if (token !== this.token) return info;
      this.draw(ride, info);
    }
    return info;
  }

  draw(ride, info) {
    const a = ride.from;
    const b = ride.to;
    const coords = info.coords || [[a.lat, a.lng], [b.lat, b.lng]];
    const loading = !info.coords && info.estimated;

    this.layer.clearLayers();
    this.coords = coords;
    this.coordsAreRoad = !!info.coords;
    L.polyline(coords, { color: "#fff", weight: 9, opacity: 0.9 }).addTo(this.layer);
    const line = L.polyline(coords, {
      color: "#4f6bff",
      weight: 5,
      opacity: loading ? 0.5 : 1,
      dashArray: loading ? "6 10" : null,
    }).addTo(this.layer);
    L.marker([a.lat, a.lng], { icon: pinIcon("pin-start") }).addTo(this.layer).bindTooltip(escapeHtml(ride.from.name), { direction: "top" });
    L.marker([b.lat, b.lng], { icon: pinIcon("pin-end") }).addTo(this.layer).bindTooltip(escapeHtml(ride.to.name), { direction: "top" });

    // Frame the route once when it is first shown (and once more when the real road
    // geometry arrives). After that the map stays wherever the user moves it.
    const fitKey = routeKey(ride.from, ride.to) + (loading ? ":est" : ":road");
    if (this.fittedKey !== fitKey) {
      this.fittedKey = fitKey;
      this.map.fitBounds(line.getBounds(), { padding: [40, 40], animate: false });
    }

    this.infoEl.innerHTML = `
      <div class="route-strip-route"><span class="dot dot-start"></span>${escapeHtml(ride.from.name)}<span class="arrow">→</span><span class="dot dot-end"></span>${escapeHtml(ride.to.name)}</div>
      <div class="route-stats">
        <div><span>Distance</span><strong>${Math.round(info.miles)} mi</strong></div>
        <div><span>Driving time</span><strong>${loading ? "calculating…" : formatDuration(info.minutes)}</strong></div>
        ${ride.time ? `<div><span>Arrival</span><strong>${loading ? "–" : arrivalTime(ride.time, info.minutes)}</strong></div>` : ""}
      </div>
      <p class="route-note">Estimated HGV driving time incl. legal rest breaks for arrival. Actual times depend on traffic.</p>`;
    if (this.onDraw) this.onDraw();
  }
}

let offerMap;

// ---------- Router ----------
const views = ["home", "offer", "find", "bookings", "ride", "sustainability", "myrides"];

function route() {
  const [name, param] = (location.hash.replace(/^#\/?/, "") || "home").split("?")[0].split("/");
  const view = views.includes(name) ? name : "home";
  views.forEach((v) => ($(`#view-${v}`).hidden = v !== view));
  // A ride detail page belongs to the "Find a Ride" section in the nav
  const navKey =
    view === "ride" ? (rideBackTarget.startsWith("#/bookings") ? "bookings" : rideBackTarget.startsWith("#/myrides") ? "myrides" : "find") : view;
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === navKey));
  window.scrollTo(0, 0);
  if (view !== "ride" && typeof stopTracking === "function") stopTracking();

  if (view === "offer") initOffer();
  if (view === "find") initFind();
  if (view === "bookings") renderBookings();
  if (view === "myrides") renderMyRides();
  if (view === "ride") renderRideDetail(param);
  if (view === "sustainability") initSustainability();
}

// ---------- Offer a Ride ----------
let offerReady = false;
function initOffer() {
  const form = $("#offer-form");
  if (!offerReady) {
    form.date.min = today();
    form.date.value = today();
    $("#vehicle-picker").innerHTML = Object.entries(VEHICLE_TYPES)
      .map(
        ([key, v], i) => `
        <label class="vehicle-option">
          <input type="radio" name="vehicle" value="${key}"${i === 0 ? " checked" : ""}>
          <span class="vehicle-card">${vehicleIcon(key)}<strong>${v.label}</strong><small>${v.detail}</small></span>
        </label>`
      )
      .join("");
    offerMap = new RouteMap("offer");
    form.addEventListener("input", (e) => {
      // Typing in a place field invalidates the previously found location
      if (e.target.name === "from" || e.target.name === "to") setOfferPlace(e.target.name, null);
      updateOfferPreview();
    });
    form.addEventListener("change", (e) => {
      if (e.target.name === "from" || e.target.name === "to") resolveOfferPlace(e.target.name);
      else updateOfferPreview();
    });
    form.addEventListener("submit", submitOffer);
    ["from", "to"].forEach((field) =>
      attachAutocomplete(form[field], (place) => {
        setOfferPlace(field, place);
        updateOfferPreview();
      })
    );
    offerReady = true;
  }
  updateOfferPreview();
}

const offerPlaces = { from: null, to: null };

function setOfferPlace(field, place, message = "") {
  offerPlaces[field] = place;
  const hint = $(`[data-hint="${field}"]`);
  hint.className = "place-hint" + (place ? " ok" : message ? " bad" : "");
  hint.textContent = place ? placeText(place) : message;
}

// Look up what the user typed; returns the place or null
async function resolveOfferPlace(field) {
  const input = $("#offer-form")[field];
  const text = input.value.trim();
  if (!text) {
    setOfferPlace(field, null);
    updateOfferPreview();
    return null;
  }
  if (offerPlaces[field]) return offerPlaces[field];
  setOfferPlace(field, null, "Looking up…");
  try {
    const place = await geocode(text);
    if (input.value.trim() !== text) return null; // user kept typing
    setOfferPlace(field, place, place ? "" : "Location not found in the UK");
  } catch (err) {
    setOfferPlace(field, null, "Location service unavailable – please try again");
  }
  updateOfferPreview();
  return offerPlaces[field];
}

function updateOfferPreview() {
  const form = $("#offer-form");
  const unit = form.unit.value;
  const qty = Number(form.priceQty.value) || 1;
  $("[data-unit-label]").textContent = unitLabel(unit, qty);

  const price = Number(form.price.value);
  const cap = Number(form.capacity.value);
  $("#price-preview").textContent =
    price > 0 && cap > 0
      ? `Customers pay ${money(price / qty)} per ${unitLabel(unit)}. Fully booked, this ride earns ${money((price / qty) * cap)}.`
      : "";

  const { from, to } = offerPlaces;
  if (from && to && distanceMiles(from, to) >= 1) offerMap.show({ from, to, time: form.time.value || "08:00" });
  else offerMap.hide();
}

async function submitOffer(e) {
  e.preventDefault();
  const form = e.target;
  const err = $("#offer-error");
  const d = Object.fromEntries(new FormData(form));

  const from = await resolveOfferPlace("from");
  const to = await resolveOfferPlace("to");

  const problems = [];
  if (!d.company.trim()) problems.push("company name");
  if (!/^\S+@\S+\.\S+$/.test(d.email)) problems.push("a valid email");
  if (!from || !to) problems.push("a start and destination within the UK");
  else if (distanceMiles(from, to) < 1) problems.push("different start and destination");
  if (!d.date || d.date < today()) problems.push("a departure date from today onwards");
  if (!(Number(d.capacity) > 0)) problems.push("available space");
  if (!(Number(d.price) > 0)) problems.push("a price");
  if (!(Number(d.priceQty) > 0)) problems.push("a price quantity");
  if (!VEHICLE_TYPES[d.vehicle]) problems.push("a vehicle type");

  if (problems.length) {
    err.textContent = "Please provide " + problems.join(", ") + ".";
    return;
  }
  err.textContent = "";

  const ride = {
    id: uid(),
    company: d.company.trim(),
    email: d.email.trim(),
    phone: d.phone.trim(),
    from,
    to,
    date: d.date,
    time: d.time,
    vehicle: d.vehicle,
    unit: d.unit,
    capacity: Number(d.capacity),
    price: Number(d.price),
    priceQty: Number(d.priceQty),
    notes: d.notes.trim(),
    booked: 0,
    own: true, // published from this browser → shown under "My Rides"
    createdAt: Date.now(),
  };
  state.rides.push(ride);
  saveState();

  form.reset();
  form.date.value = today();
  form.priceQty.value = 1;
  setOfferPlace("from", null);
  setOfferPlace("to", null);
  offerMap.hide();
  toast(`Ride ${ride.from.name} → ${ride.to.name} published.`);
  rideBackTarget = "#/myrides";
  location.hash = `#/ride/${ride.id}`;
}

// ---------- Find a Ride ----------
let findReady = false;

function initFind() {
  const form = $("#search-form");
  if (!findReady) {
    form.vehicle.innerHTML =
      `<option value="">Any</option>` + Object.entries(VEHICLE_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("");
    form.addEventListener("submit", runSearch);
    attachAutocomplete(form.from, () => {});
    attachAutocomplete(form.to, () => {});
    form.addEventListener("reset", () => {
      activeSearch = emptySearch();
      $("#search-error").textContent = "";
      setTimeout(renderRides, 0);
    });
    findReady = true;
  }
  renderRides();
}

// The search only applies when the Search button is pressed
const emptySearch = () => ({ from: null, to: null, radius: 25, date: "", minSpace: 0, unit: "", vehicle: "" });
let activeSearch = emptySearch();

async function runSearch(e) {
  e.preventDefault();
  const form = e.target;
  const err = $("#search-error");
  const btn = $("#search-btn");
  const f = Object.fromEntries(new FormData(form));
  err.textContent = "";
  btn.disabled = true;
  btn.querySelector("span").textContent = "Searching…";

  try {
    const from = f.from.trim() ? await geocode(f.from) : null;
    const to = f.to.trim() ? await geocode(f.to) : null;
    const missing = [f.from.trim() && !from && f.from, f.to.trim() && !to && f.to].filter(Boolean);
    if (missing.length) {
      err.textContent = `We couldn't find ${missing.map((m) => `“${m.trim()}”`).join(" or ")} in the UK.`;
      return;
    }
    if (from) form.from.value = from.name;
    if (to) form.to.value = to.name;
    activeSearch = {
      from,
      to,
      radius: Number(f.radius) || 25,
      date: f.date,
      minSpace: Number(f.minSpace) || 0,
      unit: f.unit,
      vehicle: f.vehicle,
    };
    renderRides();
  } catch (ex) {
    err.textContent = "The location service is unavailable right now. Please try again.";
  } finally {
    btn.disabled = false;
    btn.querySelector("span").textContent = "Search";
  }
}

function filteredRides() {
  const s = activeSearch;
  const minDate = s.date || today();
  return state.rides
    .filter((r) => r.date >= minDate && !["cancelled", "onroad", "completed"].includes(rideStatus(r).key))
    .filter((r) => !s.from || distanceMiles(r.from, s.from) <= s.radius)
    .filter((r) => !s.to || distanceMiles(r.to, s.to) <= s.radius)
    .filter((r) => !s.unit || r.unit === s.unit)
    .filter((r) => !s.vehicle || r.vehicle === s.vehicle)
    .filter((r) => freeSpace(r) >= Math.max(s.minSpace, 1))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

// "Pick-up 4 mi from Leeds" – shown when searching by location
function proximityText(r) {
  const s = activeSearch;
  const part = (label, p, q) => {
    const d = Math.round(distanceMiles(p, q));
    return d < 2 ? `${label} in ${escapeHtml(q.name)}` : `${label} ${d} mi from ${escapeHtml(q.name)}`;
  };
  const parts = [];
  if (s.from) parts.push(part("Pick-up", r.from, s.from));
  if (s.to) parts.push(part("drop-off", r.to, s.to));
  return parts.join(" · ");
}

function rideCard(r) {
  const free = freeSpace(r);
  const pct = Math.round((r.booked / r.capacity) * 100);
  return `
    <li class="ride card has-carrier" data-open="${r.id}" tabindex="0" role="link" aria-label="View ride ${escapeHtml(r.from.name)} to ${escapeHtml(r.to.name)} offered by ${escapeHtml(r.company)}">
      ${carrierRow(r, r.own ? "Your ride" : "Offered by")}
      <div class="ride-main">
        <div class="ride-route">
          <strong>${escapeHtml(r.from.name)}</strong>
          <span class="arrow">→</span>
          <strong>${escapeHtml(r.to.name)}</strong>
        </div>
        <div class="ride-meta">${formatDate(r.date)} · dep. ${escapeHtml(r.time)}</div>
        <div class="ride-vehicle v-${escapeHtml(r.vehicle)}">${vehicleIcon(r.vehicle)}${escapeHtml(vehicleText(r))}</div>
        <div class="ride-drive" data-drive="${r.id}">${driveIcon}${driveSummary(r)}</div>
        <div class="ride-eco" data-eco="${r.id}">${ecoLabel(r)}</div>
        ${activeSearch.from || activeSearch.to ? `<div class="ride-near">${proximityText(r)}</div>` : ""}
        <div class="capacity">
          <div class="bar"><span style="width:${pct}%"></span></div>
          <span>${free} of ${r.capacity} ${unitLabel(r.unit, r.capacity)} free</span>
        </div>
      </div>
      <div class="ride-side">
        <div class="price">${money(r.price)}</div>
        <div class="price-unit">per ${r.priceQty === 1 ? "" : r.priceQty + " "}${unitLabel(r.unit, r.priceQty)}</div>
        <span class="view-link">View ride <span aria-hidden="true">→</span></span>
      </div>
    </li>`;
}

const driveIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;

function refreshDriveLabels() {
  document.querySelectorAll("[data-drive]").forEach((el) => {
    const r = state.rides.find((x) => x.id === el.dataset.drive);
    if (r) el.innerHTML = driveIcon + driveSummary(r);
  });
  document.querySelectorAll("[data-eco]").forEach((el) => {
    const r = state.rides.find((x) => x.id === el.dataset.eco);
    if (r) el.innerHTML = ecoLabel(r);
  });
}

// Fetch real road times for visible rides, one at a time (gentle on the free routing service)
let prefetchGen = 0;
async function prefetchRoutes(rides) {
  const gen = ++prefetchGen;
  for (const r of rides) {
    if (gen !== prefetchGen) return;
    if (routeStats[routeKey(r.from, r.to)]) continue;
    await fetchRoute(r.from, r.to);
    refreshDriveLabels();
  }
}

function renderRides() {
  const rides = filteredRides();
  $("#results-count").textContent = rides.length ? `${rides.length} ride${rides.length === 1 ? "" : "s"} available` : "";
  $("#ride-list").innerHTML = rides.length
    ? rides.map(rideCard).join("")
    : `<li class="empty card">No rides match your search. Try widening your filters or <a href="#/offer">offer a ride</a> yourself.</li>`;
  prefetchRoutes(rides);
}

// Clicking a ride (in results or bookings) opens its detail page
let rideBackTarget = "#/find";
function openRide(id) {
  rideBackTarget = location.hash || "#/find";
  location.hash = `#/ride/${id}`;
}

document.addEventListener("click", (e) => {
  if (e.target.closest("button, a")) return;
  const card = e.target.closest("[data-open]");
  if (card) openRide(card.dataset.open);
});
document.addEventListener("keydown", (e) => {
  const card = e.target.closest && e.target.closest("[data-open]");
  if (card && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openRide(card.dataset.open);
  }
});

// ---------- Ride detail page ----------
let rideMap;
let currentRide = null;

function priceFor(ride, amount) {
  return (ride.price / ride.priceQty) * amount;
}

function addDays(iso, days) {
  const d = new Date(iso + "T00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function renderRideDetail(id) {
  const r = state.rides.find((x) => x.id === id);
  currentRide = r || null;
  $("#ride-missing").hidden = !!r;
  $("#ride-detail").hidden = !r;
  const back = $("#ride-back");
  back.href = rideBackTarget;
  back.querySelector("span").textContent = rideBackTarget.startsWith("#/bookings")
    ? "Back to my bookings"
    : rideBackTarget.startsWith("#/myrides")
    ? "Back to my rides"
    : "Back to results";
  if (!r) return;

  if (!rideMap) rideMap = new RouteMap("ride");
  const free = freeSpace(r);

  $("#ride-title").innerHTML = `${escapeHtml(r.from.name)} <span class="arrow">→</span> ${escapeHtml(r.to.name)}`;
  $("#ride-subtitle").innerHTML = `
    <span class="head-carrier">${companyAvatar(r.company)}<span>Offered by <strong>${escapeHtml(r.company)}</strong></span>${tripsBadge(r.email)}</span>
    <span class="head-date">${formatDate(r.date)} · dep. ${escapeHtml(r.time)}</span>`;
  const status = $("#ride-status");
  const st = rideStatus(r);
  if (r.own || ["onroad", "completed", "cancelled"].includes(st.key)) {
    status.textContent = st.label;
    status.className = "status-pill st-" + st.key;
  } else {
    status.textContent = free === 0 ? "Fully booked" : free < r.capacity * 0.25 ? "Almost full" : "Space available";
    status.className = "status-pill " + (free === 0 ? "full" : free < r.capacity * 0.25 ? "low" : "ok");
  }

  renderRideFacts(r);
  rideMap.show(r).then(() => currentRide === r && renderRideFacts(r));
  resetBookingPanel(r);
  if (typeof startTracking === "function") startTracking(r);

  // Your own ride: show its status instead of a booking form
  const owner = $("#owner-panel");
  owner.hidden = !r.own;
  if (r.own) {
    $("#book-panel").hidden = true;
    const rb = rideBookings(r);
    owner.innerHTML = `
      <span class="owner-tag">Your ride</span>
      <div class="owner-status">${statusPill(r)}</div>
      ${statusSteps(r)}
      <div class="owner-figures">
        <div><span>Booked</span><strong>${r.booked} / ${r.capacity} ${unitLabel(r.unit, r.capacity)}</strong></div>
        <div><span>Revenue</span><strong>${money(rideRevenue(r))}</strong></div>
        <div><span>Bookings</span><strong>${rb.length}</strong></div>
      </div>
      <a href="#/myrides" class="btn btn-primary btn-block">Open My Rides</a>`;
  }
}

// Timeline + capacity + carrier (re-rendered once the real driving time is known)
function renderRideFacts(r) {
  const info = routeInfo(r.from, r.to);
  const arr = arrivalTime(r.time, info.minutes);
  const [arrTime, plus] = arr.split(" (+");
  const arrDate = plus ? addDays(r.date, parseInt(plus, 10)) : r.date;
  const breaks = Math.floor(info.minutes / 270);

  $("#ride-timeline").innerHTML = `
    <li class="tl-start">
      <span class="tl-time">${escapeHtml(r.time)}</span>
      <div><strong>${escapeHtml(r.from.name)}</strong><span>${escapeHtml(r.from.region || "")}${r.from.region ? " · " : ""}Departure, ${formatDate(r.date)}</span></div>
    </li>
    <li class="tl-mid">
      <span class="tl-time"></span>
      <div><span>${Math.round(info.miles)} miles · ${formatDuration(info.minutes)} driving${breaks ? ` · ${breaks} rest break${breaks > 1 ? "s" : ""} (45 min)` : ""}</span></div>
    </li>
    <li class="tl-end">
      <span class="tl-time">~${escapeHtml(arrTime)}</span>
      <div><strong>${escapeHtml(r.to.name)}</strong><span>${escapeHtml(r.to.region || "")}${r.to.region ? " · " : ""}Estimated arrival, ${formatDate(arrDate)}</span></div>
    </li>`;

  const free = freeSpace(r);
  const pct = Math.round((r.booked / r.capacity) * 100);
  $("#ride-capacity").innerHTML = `
    <div class="facts-vehicle">${vehicleIcon(r.vehicle)}<div><strong>${escapeHtml(vehicleName(r))}</strong><span>${escapeHtml((VEHICLE_TYPES[r.vehicle] || {}).detail || "")}</span></div></div>
    <div><dt>Total capacity</dt><dd>${r.capacity} ${unitLabel(r.unit, r.capacity)}</dd></div>
    <div><dt>Free space</dt><dd>${free} ${unitLabel(r.unit, free)}</dd></div>
    <div class="facts-bar"><div class="bar"><span style="width:${pct}%"></span></div><small>${pct}% booked</small></div>
    <div><dt>Price</dt><dd>${money(r.price)} per ${r.priceQty === 1 ? "" : r.priceQty + " "}${unitLabel(r.unit, r.priceQty)}</dd></div>
    ${r.notes ? `<div class="facts-notes"><dt>Notes</dt><dd>${escapeHtml(r.notes)}</dd></div>` : ""}`;

  $("#book-eco").innerHTML = `${leafIcon}<span>Booking this ride avoids a separate trip – about <strong>${fmtKg(co2Saved(r))} CO₂e</strong> saved. <a href="#/sustainability">How we estimate</a></span>`;

  $("#ride-carrier").innerHTML = `
    <div class="carrier-head">${companyAvatar(r.company, "avatar-lg")}<div><strong>${escapeHtml(r.company)}</strong><span>Carrier offering this ride</span></div></div>
    ${carrierRecord(r.email)}
    <div><dt>Email</dt><dd><a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a></dd></div>
    ${r.phone ? `<div><dt>Phone</dt><dd><a href="tel:${escapeHtml(r.phone.replace(/\s/g, ""))}">${escapeHtml(r.phone)}</a></dd></div>` : ""}
    <div><dt>Listed</dt><dd>${new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd></div>`;
}

function carrierRecord(email) {
  const c = carrierStats(email);
  const since = new Date(c.since + "T00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `
    <div class="carrier-record">
      <div class="carrier-trips"><strong>${c.completed}</strong><span>successful trip${c.completed === 1 ? "" : "s"}<br>on CargoMatch</span></div>
      ${c.completed >= 50 ? `<span class="trips-badge trusted">Trusted carrier</span>` : c.completed === 0 ? `<span class="trips-badge new">New carrier</span>` : ""}
    </div>
    <div><dt>Member since</dt><dd>${since}</dd></div>
    <div><dt>Upcoming rides</dt><dd>${c.upcoming}</dd></div>`;
}

function resetBookingPanel(r) {
  const form = $("#book-form");
  const free = freeSpace(r);
  form.reset();
  $("#book-error").textContent = "";
  $("#book-success").hidden = true;
  $("#book-panel").hidden = false;
  $("#book-price").textContent = money(r.price);
  $("#book-price-unit").textContent = `per ${r.priceQty === 1 ? "" : r.priceQty + " "}${unitLabel(r.unit, r.priceQty)}`;
  $("#book-unit").textContent = unitLabel(r.unit, 2);
  $("#book-free").textContent = `${free} ${unitLabel(r.unit, free)} available`;
  form.amount.max = free;
  form.amount.value = Math.min(free, r.unit === "pallet" ? 1 : r.priceQty) || "";
  // No new bookings once the lorry has left (or the ride was withdrawn)
  const closed = ["onroad", "completed", "cancelled"].includes(rideStatus(r).key);
  form.hidden = free === 0 || closed;
  $("#book-full").hidden = !form.hidden;
  $("#book-eco").hidden = closed;
  $("#book-full").textContent = closed
    ? rideStatus(r).key === "cancelled"
      ? "This ride was withdrawn by the carrier."
      : "This ride has already departed – booking is closed."
    : "This ride is fully booked.";
  updateBookingTotal();
}

function updateBookingTotal() {
  if (!currentRide) return;
  const amount = Number($("#book-form").amount.value) || 0;
  $("#book-total").textContent = money(priceFor(currentRide, amount));
}

$("#book-form").addEventListener("input", updateBookingTotal);

$("#book-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const r = currentRide;
  const amount = Number(form.amount.value);
  const err = $("#book-error");

  if (!(amount > 0)) return (err.textContent = "Please enter an amount greater than 0.");
  if (amount > freeSpace(r)) return (err.textContent = `Only ${freeSpace(r)} ${unitLabel(r.unit, freeSpace(r))} left on this ride.`);
  if (!form.company.value.trim()) return (err.textContent = "Please enter your company name.");
  if (!/^\S+@\S+\.\S+$/.test(form.email.value)) return (err.textContent = "Please enter a valid email.");

  r.booked += amount;
  const booking = {
    id: uid(),
    rideId: r.id,
    company: form.company.value.trim(),
    email: form.email.value.trim(),
    goods: form.goods.value.trim(),
    amount,
    total: priceFor(r, amount),
    co2: co2Saved(r),
    createdAt: Date.now(),
  };
  state.bookings.push(booking);
  saveState();

  renderRideDetail(r.id);
  $("#book-panel").hidden = true;
  const ok = $("#book-success");
  ok.hidden = false;
  ok.innerHTML = `
    <div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
    <h3>Booking confirmed</h3>
    <p>${amount} ${unitLabel(r.unit, amount)} on ${escapeHtml(r.from.name)} → ${escapeHtml(r.to.name)}</p>
    <div class="total-row"><span>Total price</span><strong>${money(booking.total)}</strong></div>
    <div class="eco-note">${leafIcon}<span>You avoided a separate trip – about <strong>${fmtKg(booking.co2)} CO₂e</strong> saved.</span></div>
    <p class="hint">The carrier ${escapeHtml(r.company)} will contact you at ${escapeHtml(booking.email)}.</p>
    <a href="#/bookings" class="btn btn-primary btn-block">View my bookings</a>
    <button type="button" class="btn btn-ghost btn-block" data-chat="${booking.id}">Message the carrier</button>
    <button type="button" class="btn btn-ghost btn-block" id="book-again">Book more space</button>`;
  $("#book-again").addEventListener("click", () => resetBookingPanel(r));
});

// ---------- My Rides (rides published from this browser) ----------
const rideBookings = (r) => state.bookings.filter((b) => b.rideId === r.id);
const rideRevenue = (r) => rideBookings(r).reduce((sum, b) => sum + b.total, 0);

function departureDate(r) {
  return new Date(`${r.date}T${r.time || "00:00"}`);
}
function arrivalDateTime(r) {
  const minutes = routeInfo(r.from, r.to).minutes;
  const breaks = Math.floor(minutes / 270) * 45;
  return new Date(departureDate(r).getTime() + (minutes + breaks) * 60000);
}

// Where a ride stands right now
function rideStatus(r) {
  const now = new Date();
  if (r.status === "cancelled") return { key: "cancelled", label: "Withdrawn", step: 0 };
  if (now >= arrivalDateTime(r)) return { key: "completed", label: "Completed", step: 4 };
  if (now >= departureDate(r)) return { key: "onroad", label: "On the road", step: 3 };
  if (freeSpace(r) === 0) return { key: "full", label: "Fully booked", step: 2 };
  if (r.booked > 0) return { key: "booking", label: "Receiving bookings", step: 2 };
  return { key: "open", label: "Open – waiting for bookings", step: 1 };
}
const statusPill = (r) => {
  const st = rideStatus(r);
  return `<span class="status-pill st-${st.key}">${escapeHtml(st.label)}</span>`;
};

// 4-step progress: Published → Booked → Departed → Delivered
function statusSteps(r) {
  const st = rideStatus(r);
  if (st.key === "cancelled") return `<p class="steps-cancelled">This ride was withdrawn and is no longer shown to shippers.</p>`;
  const steps = ["Published", "Space booked", "On the road", "Delivered"];
  return `<ol class="ride-steps">${steps
    .map((label, i) => `<li class="${i + 1 < st.step || (i + 1 === st.step && st.step === 4) ? "done" : i + 1 === st.step ? "current" : ""}"><span></span>${label}</li>`)
    .join("")}</ol>`;
}

function renderMyRides() {
  const mine = state.rides.filter((r) => r.own).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const list = $("#myrides-list");
  const summary = $("#myrides-summary");

  if (!mine.length) {
    summary.innerHTML = "";
    list.innerHTML = `
      <li class="empty card myrides-empty">
        <strong>You haven't published any rides yet.</strong>
        <span>Rides you offer appear here, so you can follow bookings, revenue and status.</span>
        <a href="#/offer" class="btn btn-primary">Offer a ride</a>
      </li>`;
    return;
  }

  const active = mine.filter((r) => !["completed", "cancelled"].includes(rideStatus(r).key)).length;
  const revenue = mine.reduce((sum, r) => sum + rideRevenue(r), 0);
  const bookings = mine.reduce((sum, r) => sum + rideBookings(r).length, 0);
  const co2 = mine.reduce((sum, r) => sum + rideBookings(r).reduce((s2, b) => s2 + (b.co2 ?? co2Saved(r)), 0), 0);
  summary.innerHTML = `
    <div><span>Active rides</span><strong>${active}</strong><small>of ${mine.length} published</small></div>
    <div><span>Bookings received</span><strong>${bookings}</strong><small>from shippers</small></div>
    <div><span>Revenue</span><strong>${money(revenue)}</strong><small>from booked space</small></div>
    <div class="eco"><span>CO₂e saved</span><strong>~${fmtKg(co2)}</strong><small>by sharing your rides</small></div>`;

  list.innerHTML = mine
    .map((r) => {
      const st = rideStatus(r);
      const rb = rideBookings(r);
      const pct = Math.round((r.booked / r.capacity) * 100);
      const canWithdraw = !["onroad", "completed", "cancelled"].includes(st.key);
      return `
      <li class="card myride st-${st.key}">
        <div class="myride-head">
          <div>
            <div class="ride-route"><strong>${escapeHtml(r.from.name)}</strong><span class="arrow">→</span><strong>${escapeHtml(r.to.name)}</strong></div>
            <div class="ride-meta">${formatDate(r.date)} · dep. ${escapeHtml(r.time)} · ${escapeHtml(vehicleText(r))} · ${driveSummary(r)}</div>
          </div>
          ${statusPill(r)}
        </div>
        ${statusSteps(r)}
        <div class="myride-figures">
          <div>
            <span>Space booked</span>
            <strong>${r.booked} of ${r.capacity} ${unitLabel(r.unit, r.capacity)}</strong>
            <div class="bar"><span style="width:${pct}%"></span></div>
          </div>
          <div><span>Revenue</span><strong>${money(rideRevenue(r))}</strong><small>max. ${money(priceFor(r, r.capacity))}</small></div>
          <div><span>Price</span><strong>${money(r.price)}</strong><small>per ${r.priceQty === 1 ? "" : r.priceQty + " "}${unitLabel(r.unit, r.priceQty)}</small></div>
        </div>
        <div class="myride-bookings">
          <h4>Bookings (${rb.length})</h4>
          ${
            rb.length
              ? `<ul>${rb
                  .map(
                    (b) => `<li>${companyAvatar(b.company)}<div><strong>${escapeHtml(b.company)}</strong><span>${b.amount} ${unitLabel(r.unit, b.amount)}${b.goods ? " · " + escapeHtml(b.goods) : ""} · <a href="mailto:${escapeHtml(b.email)}">${escapeHtml(b.email)}</a></span></div><b>${money(b.total)}</b><button type="button" class="btn btn-ghost btn-sm" data-chat="${b.id}">${typeof chatButtonLabel === "function" ? chatButtonLabel(b, "Message") : "Message"}</button></li>`
                  )
                  .join("")}</ul>`
              : `<p>No bookings yet. Your ride is visible to shippers searching along this route.</p>`
          }
        </div>
        <div class="myride-actions">
          <a href="#/ride/${r.id}" class="btn btn-ghost btn-sm" data-myride-open="${r.id}">View ride</a>
          ${canWithdraw ? `<button type="button" class="btn btn-ghost btn-sm btn-danger" data-withdraw="${r.id}">Withdraw ride</button>` : ""}
        </div>
      </li>`;
    })
    .join("");
}

$("#myrides-list").addEventListener("click", (e) => {
  const open = e.target.closest("[data-myride-open]");
  if (open) {
    e.preventDefault();
    openRide(open.dataset.myrideOpen);
    return;
  }
  const btn = e.target.closest("[data-withdraw]");
  if (!btn) return;
  const r = state.rides.find((x) => x.id === btn.dataset.withdraw);
  if (!r) return;
  const n = rideBookings(r).length;
  const msg = n
    ? `Withdraw this ride? It has ${n} booking${n === 1 ? "" : "s"} – please contact the shipper${n === 1 ? "" : "s"} yourself.`
    : "Withdraw this ride? It will no longer be shown to shippers.";
  if (!confirm(msg)) return;
  r.status = "cancelled";
  saveState();
  renderMyRides();
  toast("Ride withdrawn.");
});

// ---------- My Bookings ----------
// Bookings made from this browser – bookings received on your own rides belong to My Rides
const myBookings = () =>
  state.bookings.filter((b) => !b.received && !(state.rides.find((r) => r.id === b.rideId) || {}).own);

function renderBookings() {
  const list = $("#booking-list");
  const summary = $("#eco-summary");
  const made = myBookings();
  summary.hidden = !made.length;
  if (!made.length) {
    list.innerHTML = `<li class="empty card">You haven't booked any space yet. <a href="#/find">Find a ride</a>.</li>`;
    return;
  }
  const totalCo2 = made.reduce((sum, b) => {
    const r = state.rides.find((x) => x.id === b.rideId);
    return sum + (b.co2 ?? (r ? co2Saved(r) : 0));
  }, 0);
  const n = made.length;
  summary.innerHTML = `
    <div class="eco-summary-icon">${leafIcon}</div>
    <div><span>Your impact</span><strong>~${fmtKg(totalCo2)} CO₂e saved</strong><small>by sharing ${n} existing ride${n === 1 ? "" : "s"} instead of booking separate trips</small></div>
    <span class="eco-teaser-link">Learn more <span aria-hidden="true">→</span></span>`;
  list.innerHTML = made
    .slice()
    .reverse()
    .map((b) => {
      const r = state.rides.find((x) => x.id === b.rideId);
      if (!r) return "";
      return `
      <li class="ride card has-carrier" data-open="${r.id}" tabindex="0" role="link">
        ${carrierRow(r, "Carrier")}
        <div class="ride-main">
          <div class="ride-route"><strong>${escapeHtml(r.from.name)}</strong><span class="arrow">→</span><strong>${escapeHtml(r.to.name)}</strong></div>
          <div class="ride-meta">${formatDate(r.date)} · dep. ${escapeHtml(r.time)} · <a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a></div>
          <div class="ride-drive">${driveIcon}${driveSummary(r)}</div>
          <div class="ride-company">Booked by ${escapeHtml(b.company)}${b.goods ? " · " + escapeHtml(b.goods) : ""}</div>
        </div>
        <div class="ride-side">
          <div class="price">${money(b.total)}</div>
          <div class="price-unit">${b.amount} ${unitLabel(r.unit, b.amount)}</div>
          ${typeof bookingStatusPill === "function" ? bookingStatusPill(r) : statusPill(r)}
        </div>
        ${typeof bookingActions === "function" ? bookingActions(b, r) : ""}
      </li>`;
    })
    .join("");
}

$("#booking-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-cancel]");
  if (!btn) return;
  const idx = state.bookings.findIndex((b) => b.id === btn.dataset.cancel);
  if (idx < 0) return;
  const b = state.bookings[idx];
  const r = state.rides.find((x) => x.id === b.rideId);
  if (r) r.booked = Math.max(0, r.booked - b.amount);
  state.bookings.splice(idx, 1);
  saveState();
  renderBookings();
  toast("Booking cancelled.");
});

// ---------- Sustainability page ----------
const UK_EMPTY_KM = 5843e6; // DfT 2024
const EMPTY_FACTORS_KM = [0.74 / 1.609344, 1.17 / 1.609344]; // DESNZ 2025, kg CO2e per km at 0% load
let ecoReady = false;

function initSustainability() {
  if (ecoReady) return;
  ecoReady = true;
  // 10 lorries: 7 loaded, 3 empty (30%)
  const truck = `<svg viewBox="0 0 60 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="37" height="15" rx="1.5"/><path d="M42 21V10h9l6 6v5z"/><circle cx="10" cy="24" r="3"/><circle cx="18" cy="24" r="3"/><circle cx="33" cy="24" r="3"/><circle cx="50" cy="24" r="3"/></svg>`;
  $("#fleet-grid").innerHTML = Array.from({ length: 10 }, (_, i) => `<span class="fleet-truck ${i >= 7 ? "is-empty" : "is-loaded"}" style="--i:${i}">${truck}</span>`).join("");

  const slider = $("#eco-slider");
  const round = (n) => Math.round(n / 100) * 100;
  const fmt = (n) => n.toLocaleString("en-GB");
  const update = () => {
    const pct = Number(slider.value);
    const km = (UK_EMPTY_KM * pct) / 100;
    const [lo, hi] = EMPTY_FACTORS_KM.map((f) => (km * f) / 1000);
    $("#eco-pct").textContent = `${pct.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;
    $("#eco-km").textContent = km >= 1e9 ? `${(km / 1e9).toFixed(2)} billion` : `${fmt(Math.round(km / 1e6))} million`;
    $("#eco-co2").textContent = `${fmt(round(lo))} – ${fmt(round(hi))} t`;
    slider.style.setProperty("--fill", `${((pct - 0.1) / 9.9) * 100}%`);
  };
  slider.addEventListener("input", update);
  // The pulsing hint stops once the visitor has moved the slider
  slider.addEventListener("input", () => $("#eco-calc").classList.remove("is-idle"), { once: true });
  update();
}

// ---------- Boot ----------
window.addEventListener("hashchange", route);
// Run after every script (incl. features.js) has loaded
document.addEventListener("DOMContentLoaded", route);
