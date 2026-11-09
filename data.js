// UK locations supported by CargoMatch (service area: United Kingdom only)
const UK_CITIES = [
  // England
  { name: "London", region: "England", lat: 51.5074, lng: -0.1278 },
  { name: "Birmingham", region: "England", lat: 52.4862, lng: -1.8904 },
  { name: "Manchester", region: "England", lat: 53.4808, lng: -2.2426 },
  { name: "Liverpool", region: "England", lat: 53.4084, lng: -2.9916 },
  { name: "Leeds", region: "England", lat: 53.8008, lng: -1.5491 },
  { name: "Sheffield", region: "England", lat: 53.3811, lng: -1.4701 },
  { name: "Bristol", region: "England", lat: 51.4545, lng: -2.5879 },
  { name: "Newcastle upon Tyne", region: "England", lat: 54.9783, lng: -1.6178 },
  { name: "Nottingham", region: "England", lat: 52.9548, lng: -1.1581 },
  { name: "Leicester", region: "England", lat: 52.6369, lng: -1.1398 },
  { name: "Coventry", region: "England", lat: 52.4068, lng: -1.5197 },
  { name: "Southampton", region: "England", lat: 50.9097, lng: -1.4044 },
  { name: "Portsmouth", region: "England", lat: 50.8198, lng: -1.088 },
  { name: "Plymouth", region: "England", lat: 50.3755, lng: -4.1427 },
  { name: "Exeter", region: "England", lat: 50.7184, lng: -3.5339 },
  { name: "Norwich", region: "England", lat: 52.6309, lng: 1.2974 },
  { name: "Cambridge", region: "England", lat: 52.2053, lng: 0.1218 },
  { name: "Oxford", region: "England", lat: 51.752, lng: -1.2577 },
  { name: "Reading", region: "England", lat: 51.4543, lng: -0.9781 },
  { name: "Milton Keynes", region: "England", lat: 52.0406, lng: -0.7594 },
  { name: "Northampton", region: "England", lat: 52.2405, lng: -0.9027 },
  { name: "Hull", region: "England", lat: 53.7676, lng: -0.3274 },
  { name: "York", region: "England", lat: 53.959, lng: -1.0815 },
  { name: "Carlisle", region: "England", lat: 54.8925, lng: -2.9329 },
  { name: "Preston", region: "England", lat: 53.7632, lng: -2.7031 },
  { name: "Stoke-on-Trent", region: "England", lat: 53.0027, lng: -2.1794 },
  { name: "Dover", region: "England", lat: 51.1279, lng: 1.3134 },
  { name: "Felixstowe", region: "England", lat: 51.9617, lng: 1.3513 },
  { name: "Ipswich", region: "England", lat: 52.0567, lng: 1.1482 },
  { name: "Brighton", region: "England", lat: 50.8225, lng: -0.1372 },
  { name: "Gloucester", region: "England", lat: 51.8642, lng: -2.2382 },
  { name: "Middlesbrough", region: "England", lat: 54.5742, lng: -1.2349 },
  // Scotland
  { name: "Glasgow", region: "Scotland", lat: 55.8642, lng: -4.2518 },
  { name: "Edinburgh", region: "Scotland", lat: 55.9533, lng: -3.1883 },
  { name: "Aberdeen", region: "Scotland", lat: 57.1497, lng: -2.0943 },
  { name: "Dundee", region: "Scotland", lat: 56.462, lng: -2.9707 },
  { name: "Inverness", region: "Scotland", lat: 57.4778, lng: -4.2247 },
  // Wales
  { name: "Cardiff", region: "Wales", lat: 51.4816, lng: -3.1791 },
  { name: "Swansea", region: "Wales", lat: 51.6214, lng: -3.9436 },
  { name: "Newport", region: "Wales", lat: 51.5842, lng: -2.9977 },
  { name: "Wrexham", region: "Wales", lat: 53.0466, lng: -2.9925 },
  // Northern Ireland
  { name: "Belfast", region: "Northern Ireland", lat: 54.5973, lng: -5.9301 },
  { name: "Derry~Londonderry", region: "Northern Ireland", lat: 54.9966, lng: -7.3086 },
];

// Demo rides so the marketplace isn't empty on first load
function buildSeedRides() {
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  return [
    { company: "Midlands Haulage Ltd", email: "dispatch@midlandshaulage.co.uk", phone: "", from: "Birmingham", to: "Glasgow", date: day(1), time: "06:30", vehicle: "artic", unit: "pallet", capacity: 18, price: 38, priceQty: 1, notes: "Tail-lift available." },
    { company: "Thames Freight Co.", email: "ops@thamesfreight.co.uk", phone: "", from: "London", to: "Manchester", date: day(2), time: "05:00", vehicle: "artic", unit: "pallet", capacity: 10, price: 42, priceQty: 1, notes: "" },
    { company: "Severn Logistics", email: "book@severnlogistics.co.uk", phone: "", from: "Bristol", to: "Leeds", date: day(2), time: "09:00", vehicle: "rigid", unit: "m³", capacity: 25, price: 60, priceQty: 5, notes: "" },
    { company: "Highland Transport", email: "hello@highlandtransport.scot", phone: "", from: "Inverness", to: "Edinburgh", date: day(3), time: "07:15", vehicle: "rigid", unit: "pallet", capacity: 8, price: 30, priceQty: 1, notes: "" },
    { company: "Cymru Carriers", email: "info@cymrucarriers.wales", phone: "", from: "Cardiff", to: "London", date: day(4), time: "04:45", vehicle: "artic", unit: "kg", capacity: 9000, price: 25, priceQty: 100, notes: "No hazardous goods." },
    { company: "Quick Freight Couriers", email: "jobs@quickvan.co.uk", phone: "+44 161 555 0142", from: "Manchester", to: "Leeds", date: day(1), time: "13:00", vehicle: "truck75", unit: "m³", capacity: 6, price: 30, priceQty: 1, notes: "Ideal for small parcels and boxes." },
    { company: "Kent Box Logistics", email: "hello@kentbox.co.uk", phone: "", from: "Dover", to: "Reading", date: day(3), time: "11:30", vehicle: "truck75", unit: "pallet", capacity: 6, price: 45, priceQty: 1, notes: "Tail-lift fitted." },
    { company: "East Coast Shipping", email: "loads@eastcoastship.co.uk", phone: "", from: "Felixstowe", to: "Birmingham", date: day(5), time: "10:00", vehicle: "artic", unit: "pallet", capacity: 22, price: 35, priceQty: 1, notes: "Port pick-up possible." },
    { company: "Midlands Haulage Ltd", email: "dispatch@midlandshaulage.co.uk", phone: "01632 960101", from: "Glasgow", to: "Birmingham", date: day(2), time: "14:00", vehicle: "artic", unit: "pallet", capacity: 26, price: 30, priceQty: 1, booked: 5, notes: "Return trip – otherwise driving back empty." },
    { company: "Thames Freight Co.", email: "ops@thamesfreight.co.uk", phone: "", from: "Manchester", to: "London", date: day(4), time: "13:00", vehicle: "artic", unit: "pallet", capacity: 18, price: 40, priceQty: 1, booked: 2, notes: "Return leg, flexible pick-up in Greater Manchester." },
    { company: "Severn Logistics", email: "book@severnlogistics.co.uk", phone: "", from: "Gloucester", to: "Cardiff", date: day(10), time: "10:30", vehicle: "rigid", unit: "m³", capacity: 20, price: 50, priceQty: 5, booked: 0, notes: "" },
    { company: "Highland Transport", email: "hello@highlandtransport.scot", phone: "", from: "Edinburgh", to: "Inverness", date: day(11), time: "14:00", vehicle: "rigid", unit: "pallet", capacity: 10, price: 28, priceQty: 1, booked: 3, notes: "Return trip to the Highlands." },
    { company: "East Coast Shipping", email: "loads@eastcoastship.co.uk", phone: "", from: "Ipswich", to: "Leeds", date: day(12), time: "05:45", vehicle: "artic", unit: "pallet", capacity: 26, price: 34, priceQty: 1, booked: 21, notes: "Almost full – book quickly." },
    { company: "Kent Box Logistics", email: "hello@kentbox.co.uk", phone: "", from: "Dover", to: "Milton Keynes", date: day(8), time: "12:00", vehicle: "truck75", unit: "pallet", capacity: 6, price: 44, priceQty: 1, booked: 0, notes: "Tail-lift fitted." },
    { company: "Northern Freight Lines", email: "bookings@northernfreight.co.uk", phone: "01632 960214", from: "Newcastle upon Tyne", to: "London", date: day(1), time: "05:30", vehicle: "artic", unit: "pallet", capacity: 14, price: 45, priceQty: 1, booked: 6, notes: "Return leg after a Tyneside delivery." },
    { company: "Pennine Logistics", email: "ops@penninelogistics.co.uk", phone: "", from: "Leeds", to: "Bristol", date: day(2), time: "07:00", vehicle: "rigid", unit: "pallet", capacity: 10, price: 36, priceQty: 1, booked: 3, notes: "" },
    { company: "Solent Carriers", email: "dispatch@solentcarriers.co.uk", phone: "01632 960327", from: "Southampton", to: "Birmingham", date: day(2), time: "06:00", vehicle: "artic", unit: "pallet", capacity: 20, price: 32, priceQty: 1, booked: 12, notes: "Collections from Southampton docks possible." },
    { company: "Anglia Haulage", email: "hello@angliahaulage.co.uk", phone: "", from: "Norwich", to: "Leicester", date: day(3), time: "08:30", vehicle: "rigid", unit: "m³", capacity: 30, price: 55, priceQty: 5, booked: 10, notes: "Curtain-sider, side loading." },
    { company: "Clyde Express", email: "loads@clydeexpress.scot", phone: "", from: "Glasgow", to: "Aberdeen", date: day(3), time: "06:45", vehicle: "artic", unit: "pallet", capacity: 16, price: 34, priceQty: 1, booked: 0, notes: "" },
    { company: "Mersey Freight Co.", email: "jobs@merseyvan.co.uk", phone: "01632 960412", from: "Liverpool", to: "Preston", date: day(1), time: "15:00", vehicle: "truck75", unit: "m³", capacity: 8, price: 25, priceQty: 1, booked: 2, notes: "Same-day delivery possible." },
    { company: "Cotswold Couriers", email: "book@cotswoldcouriers.co.uk", phone: "", from: "Oxford", to: "Cambridge", date: day(4), time: "09:30", vehicle: "truck75", unit: "m³", capacity: 6, price: 28, priceQty: 1, booked: 0, notes: "Ideal for boxes and small furniture." },
    { company: "Humber Transport", email: "ops@humbertransport.co.uk", phone: "", from: "Hull", to: "Manchester", date: day(4), time: "05:15", vehicle: "artic", unit: "kg", capacity: 12000, price: 22, priceQty: 100, booked: 3000, notes: "No hazardous goods." },
    { company: "Tees Valley Freight", email: "info@teesvalleyfreight.co.uk", phone: "", from: "Middlesbrough", to: "Leeds", date: day(5), time: "07:30", vehicle: "truck75", unit: "pallet", capacity: 6, price: 40, priceQty: 1, booked: 0, notes: "" },
    { company: "Dragon Haulage", email: "post@dragonhaulage.wales", phone: "", from: "Swansea", to: "Bristol", date: day(5), time: "06:00", vehicle: "rigid", unit: "pallet", capacity: 12, price: 33, priceQty: 1, booked: 4, notes: "Tail-lift available." },
    { company: "Peninsula Freight", email: "dispatch@peninsulafreight.co.uk", phone: "", from: "Plymouth", to: "London", date: day(6), time: "04:30", vehicle: "artic", unit: "pallet", capacity: 24, price: 48, priceQty: 1, booked: 9, notes: "Overnight trunking to London depots." },
    { company: "Lothian Logistics", email: "hello@lothianlogistics.scot", phone: "", from: "Edinburgh", to: "Newcastle upon Tyne", date: day(6), time: "08:00", vehicle: "rigid", unit: "pallet", capacity: 8, price: 35, priceQty: 1, booked: 0, notes: "" },
    { company: "Ulster Road Freight", email: "bookings@ulsterroadfreight.co.uk", phone: "", from: "Belfast", to: "Derry~Londonderry", date: day(3), time: "10:00", vehicle: "truck75", unit: "pallet", capacity: 6, price: 29, priceQty: 1, booked: 2, notes: "" },
    { company: "Potteries Distribution", email: "ops@potteriesdistribution.co.uk", phone: "", from: "Stoke-on-Trent", to: "Southampton", date: day(7), time: "06:30", vehicle: "artic", unit: "pallet", capacity: 18, price: 39, priceQty: 1, booked: 0, notes: "Fragile ceramics welcome – careful handling." },
    { company: "Granite City Transport", email: "jobs@granitecitytransport.scot", phone: "", from: "Aberdeen", to: "Dundee", date: day(7), time: "09:00", vehicle: "truck75", unit: "m³", capacity: 10, price: 20, priceQty: 1, booked: 4, notes: "" },
    { company: "Wessex Freight", email: "info@wessexfreight.co.uk", phone: "", from: "Portsmouth", to: "Reading", date: day(8), time: "07:45", vehicle: "rigid", unit: "pallet", capacity: 12, price: 31, priceQty: 1, booked: 0, notes: "" },
    { company: "Northampton Logistics Hub", email: "dispatch@nnlogisticshub.co.uk", phone: "", from: "Northampton", to: "Sheffield", date: day(9), time: "06:15", vehicle: "artic", unit: "pallet", capacity: 22, price: 37, priceQty: 1, booked: 14, notes: "" },
    { company: "Cumbria Carriers", email: "hello@cumbriacarriers.co.uk", phone: "", from: "Carlisle", to: "Glasgow", date: day(9), time: "11:00", vehicle: "truck75", unit: "pallet", capacity: 7, price: 27, priceQty: 1, booked: 0, notes: "" },
    { company: "Brighton Courier Freight", email: "book@brightoncouriervans.co.uk", phone: "", from: "Brighton", to: "London", date: day(10), time: "08:00", vehicle: "truck75", unit: "m³", capacity: 7, price: 24, priceQty: 1, booked: 1, notes: "Central London drop-offs included." },
    { company: "Wrexham Freight", email: "ops@wrexhamfreight.wales", phone: "", from: "Wrexham", to: "Nottingham", date: day(12), time: "07:00", vehicle: "rigid", unit: "kg", capacity: 8000, price: 20, priceQty: 100, booked: 0, notes: "" },
    { company: "Coventry Express Freight", email: "hello@coventryexpress.co.uk", phone: "", from: "Coventry", to: "Cambridge", date: day(13), time: "09:00", vehicle: "truck75", unit: "m³", capacity: 9, price: 26, priceQty: 1, booked: 0, notes: "" },
    { company: "Newport Distribution", email: "dispatch@newportdistribution.wales", phone: "", from: "Newport", to: "Plymouth", date: day(14), time: "06:30", vehicle: "artic", unit: "pallet", capacity: 20, price: 36, priceQty: 1, booked: 0, notes: "" },
    { company: "York Fresh Logistics", email: "cold@yorkfresh.co.uk", phone: "", from: "York", to: "Edinburgh", date: day(5), time: "03:30", vehicle: "rigid", unit: "pallet", capacity: 8, price: 42, priceQty: 1, booked: 5, notes: "Refrigerated – chilled goods only." },
    { company: "Fenland Freight", email: "ops@fenlandfreight.co.uk", phone: "", from: "Cambridge", to: "Hull", date: day(11), time: "08:15", vehicle: "truck75", unit: "pallet", capacity: 8, price: 30, priceQty: 1, booked: 0, notes: "" },
  ];
}

// Turn a known city name into a place object { name, region, lat, lng }
function cityPlace(name) {
  const c = UK_CITIES.find((x) => x.name === name);
  return c ? { name: c.name, region: c.region, lat: c.lat, lng: c.lng } : null;
}

// ---------- Vehicles ----------
const VEHICLE_TYPES = {
  artic: { label: "Articulated lorry", detail: "HGV · up to 44 t · ~26 pallets" },
  rigid: { label: "Rigid truck", detail: "HGV · 18–26 t · ~16 pallets" },
  truck75: { label: "7.5 t truck", detail: "Light truck · ~8 pallets" },
};

// Earlier versions stored a single free-text vehicle label
const LEGACY_VEHICLES = {
  "Articulated lorry (44t)": { vehicle: "artic" },
  "Rigid truck (18t)": { vehicle: "rigid" },
  "Rigid truck (7.5t)": { vehicle: "truck75" },
  "Large van (3.5t)": { vehicle: "truck75" },
};

// ---------- Carrier track record ----------
// Trips completed before this prototype's data starts (demo values for the seed companies).
// Further completed trips are counted automatically from rides in the app.
const CARRIER_HISTORY = {
  "dispatch@midlandshaulage.co.uk": { completed: 214, since: "2023-03-14" },
  "ops@thamesfreight.co.uk": { completed: 87, since: "2024-01-09" },
  "book@severnlogistics.co.uk": { completed: 41, since: "2024-08-22" },
  "hello@highlandtransport.scot": { completed: 12, since: "2025-06-02" },
  "info@cymrucarriers.wales": { completed: 156, since: "2023-09-30" },
  "jobs@quickvan.co.uk": { completed: 63, since: "2024-11-18" },
  "hello@kentbox.co.uk": { completed: 3, since: "2026-09-05" },
  "loads@eastcoastship.co.uk": { completed: 302, since: "2022-11-01" },
  "dispatch@albionhaulage.co.uk": { completed: 12, since: "2026-02-16" },
  "bookings@northernfreight.co.uk": { completed: 178, since: "2023-05-20" },
  "ops@penninelogistics.co.uk": { completed: 54, since: "2024-04-11" },
  "dispatch@solentcarriers.co.uk": { completed: 231, since: "2023-02-03" },
  "hello@angliahaulage.co.uk": { completed: 29, since: "2025-01-15" },
  "loads@clydeexpress.scot": { completed: 96, since: "2023-10-08" },
  "jobs@merseyvan.co.uk": { completed: 142, since: "2024-02-27" },
  "book@cotswoldcouriers.co.uk": { completed: 8, since: "2026-03-19" },
  "ops@humbertransport.co.uk": { completed: 67, since: "2024-06-30" },
  "info@teesvalleyfreight.co.uk": { completed: 0, since: null },
  "post@dragonhaulage.wales": { completed: 45, since: "2024-09-12" },
  "dispatch@peninsulafreight.co.uk": { completed: 119, since: "2023-08-01" },
  "hello@lothianlogistics.scot": { completed: 17, since: "2025-10-02" },
  "bookings@ulsterroadfreight.co.uk": { completed: 38, since: "2024-12-05" },
  "ops@potteriesdistribution.co.uk": { completed: 73, since: "2024-03-22" },
  "jobs@granitecitytransport.scot": { completed: 5, since: "2026-06-14" },
  "info@wessexfreight.co.uk": { completed: 61, since: "2024-07-18" },
  "dispatch@nnlogisticshub.co.uk": { completed: 264, since: "2022-09-26" },
  "hello@cumbriacarriers.co.uk": { completed: 0, since: null },
  "book@brightoncouriervans.co.uk": { completed: 88, since: "2024-01-29" },
  "ops@wrexhamfreight.wales": { completed: 22, since: "2025-04-07" },
  "hello@coventryexpress.co.uk": { completed: 11, since: "2025-12-01" },
  "dispatch@newportdistribution.wales": { completed: 49, since: "2024-10-21" },
  "cold@yorkfresh.co.uk": { completed: 34, since: "2025-02-11" },
  "ops@fenlandfreight.co.uk": { completed: 2, since: "2026-08-30" },
};

// Vans were removed as a vehicle type: rides saved earlier as "van" become 7.5 t trucks,
// and carriers whose names referred to vans were renamed (matched by email).
const VEHICLE_RENAMES = { van: "truck75" };
const COMPANY_RENAMES = {
  "jobs@quickvan.co.uk": "Quick Freight Couriers",
  "jobs@merseyvan.co.uk": "Mersey Freight Co.",
  "book@brightoncouriervans.co.uk": "Brighton Courier Freight",
  "hello@coventryexpress.co.uk": "Coventry Express Freight",
};

// ---------- Demo rides of "your" company (shown under My Rides) ----------
// They cover every status: completed, on the road, receiving bookings, fully booked and open.
// `bookings` are bookings received from shippers.
function buildOwnDemoRides() {
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  // A ride that left two hours ago, so it shows as "On the road"
  const left = new Date(Date.now() - 2 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  const onRoadDate = `${left.getFullYear()}-${pad(left.getMonth() + 1)}-${pad(left.getDate())}`;
  const onRoadTime = `${pad(left.getHours())}:${pad(left.getMinutes())}`;

  const carrier = { company: "Albion Haulage Ltd", email: "dispatch@albionhaulage.co.uk", phone: "01632 960555" };
  return [
    { ...carrier, from: "Leeds", to: "London", date: day(-12), time: "06:00", vehicle: "artic", unit: "pallet", capacity: 20, price: 40, priceQty: 1, notes: "Return trip after a delivery in Leeds.",
      bookings: [
        { company: "Northern Textiles plc", email: "logistics@northerntextiles.co.uk", goods: "Boxed clothing", amount: 8 },
        { company: "Aire Valley Foods", email: "orders@airevalleyfoods.co.uk", goods: "Packaged food", amount: 6 },
      ] },
    { ...carrier, from: "Manchester", to: "Bristol", date: day(-4), time: "07:30", vehicle: "rigid", unit: "pallet", capacity: 12, price: 35, priceQty: 1, notes: "",
      bookings: [{ company: "Pennine Paper Co.", email: "shipping@penninepaper.co.uk", goods: "Paper rolls", amount: 5 }] },
    { ...carrier, from: "Sheffield", to: "Glasgow", date: onRoadDate, time: onRoadTime, vehicle: "artic", unit: "pallet", capacity: 18, price: 42, priceQty: 1, notes: "",
      bookings: [
        { company: "Steel City Tools", email: "dispatch@steelcitytools.co.uk", goods: "Hand tools", amount: 7 },
        { company: "Peak Ceramics", email: "sales@peakceramics.co.uk", goods: "Tiles (fragile)", amount: 4 },
      ] },
    { ...carrier, from: "Leeds", to: "Southampton", date: day(2), time: "05:30", vehicle: "artic", unit: "pallet", capacity: 22, price: 38, priceQty: 1, notes: "Port drop-off at Southampton docks possible.",
      bookings: [
        { company: "Humber Electronics", email: "logistics@humberelectronics.co.uk", goods: "Boxed electronics", amount: 6 },
        { company: "Leeds Print Works", email: "office@leedsprintworks.co.uk", goods: "Printed matter", amount: 3 },
      ] },
    { ...carrier, from: "Newcastle upon Tyne", to: "Edinburgh", date: day(3), time: "09:00", vehicle: "truck75", unit: "pallet", capacity: 6, price: 30, priceQty: 1, notes: "",
      bookings: [
        { company: "Tyne Coffee Roasters", email: "hello@tynecoffee.co.uk", goods: "Coffee sacks", amount: 4 },
        { company: "North East Books", email: "orders@northeastbooks.co.uk", goods: "Books", amount: 2 },
      ] },
    { ...carrier, from: "Leeds", to: "Cardiff", date: day(6), time: "06:15", vehicle: "rigid", unit: "m³", capacity: 30, price: 50, priceQty: 5, notes: "Curtain-sider, side loading.", bookings: [] },
  ];
}
