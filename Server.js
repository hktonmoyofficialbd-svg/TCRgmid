// Free Fire Player Stats - সার্ভার (Node.js 18+, কোনো প্যাকেজ লাগে না)
// চালানো: node server.js   তারপর http://localhost:3000 খুলুন
//
// আসল ডেটার জন্য একটি থার্ড-পার্টি API বসান:
//   FF_API_URL="https://your-api.example.com/player?uid={uid}&region={region}" node server.js
// API কী লাগলে: FF_API_KEY="xxxx" (Authorization: Bearer হেডারে যাবে)
// FF_API_URL না দিলে ডেমো ডেটা দেখাবে।

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_URL = process.env.FF_API_URL || "";
const API_KEY = process.env.FF_API_KEY || "";

// বিভিন্ন API-র আলাদা ফিল্ডের নাম থেকে একই ফরম্যাটে আনা
function pick(obj, keys, def = 0) {
  for (const k of keys) {
    const v = k.split(".").reduce((o, p) => (o ? o[p] : undefined), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return def;
}

function normalize(raw, uid) {
  const d = raw.data || raw;
  const matches = Number(pick(d, ["matches", "totalMatches", "stats.matches", "gamesPlayed"]));
  const wins = Number(pick(d, ["wins", "booyah", "stats.wins"]));
  const kills = Number(pick(d, ["kills", "totalKills", "stats.kills"]));
  const headshots = Number(pick(d, ["headshots", "headshotKills", "stats.headshots"]));
  const deaths = Math.max(matches - wins, 0);
  const kd = Number(pick(d, ["kd", "kdRatio", "stats.kd"], deaths ? kills / deaths : kills));
  const hsRate = Number(pick(d, ["headshotRate", "hsRate"], kills ? (headshots / kills) * 100 : 0));
  return {
    uid,
    name: pick(d, ["nickname", "name", "playerName"], "Unknown"),
    level: pick(d, ["level", "accountLevel"], "-"),
    region: pick(d, ["region"], "-"),
    likes: pick(d, ["likes", "liked"], 0),
    guild: pick(d, ["guild", "guildName", "clan"], "-"),
    rank: pick(d, ["rank", "brRank", "rankedTier"], "-"),
    rankPoints: pick(d, ["rankPoints", "rankingPoints"], 0),
    csRank: pick(d, ["csRank"], "-"),
    matches, wins, kills, headshots,
    winRate: matches ? (wins / matches) * 100 : 0,
    kd: Number(kd.toFixed(2)),
    headshotRate: Number(hsRate.toFixed(2)),
    avgKills: matches ? Number((kills / matches).toFixed(2)) : 0,
    demo: false,
  };
}

function demo(uid) {
  const seed = [...String(uid)].reduce((a, c) => a + Number(c), 0);
  const matches = 1500 + seed * 37, wins = Math.floor(matches * 0.17);
  const kills = Math.floor(matches * 3.1), headshots = Math.floor(kills * 0.34);
  return {
    uid, name: "DemoPlayer" + seed, level: 40 + (seed % 30), region: "BD",
    likes: 1000 + seed * 21, guild: "Demo Guild",
    rank: "Heroic", rankPoints: 3200 + seed * 5, csRank: "Master",
    matches, wins, kills, headshots,
    winRate: Number(((wins / matches) * 100).toFixed(2)),
    kd: Number((kills / (matches - wins)).toFixed(2)),
    headshotRate: Number(((headshots / kills) * 100).toFixed(2)),
    avgKills: Number((kills / matches).toFixed(2)),
    demo: true,
  };
}

async function handleApi(req, res, url) {
  const uid = (url.searchParams.get("uid") || "").trim();
  const region = (url.searchParams.get("region") || "BD").trim().toUpperCase();
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!/^\d{6,12}$/.test(uid)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "UID শুধু সংখ্যা হতে হবে (৬-১২ ডিজিট)" }));
  }
  if (!API_URL) return res.end(JSON.stringify(demo(uid)));
  try {
    const target = API_URL.replace("{uid}", encodeURIComponent(uid)).replace("{region}", encodeURIComponent(region));
    const r = await fetch(target, { headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {} });
    if (!r.ok) throw new Error("API স্ট্যাটাস " + r.status);
    res.end(JSON.stringify(normalize(await r.json(), uid)));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "ডেটা আনা যায়নি: " + e.message }));
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/player") return handleApi(req, res, url);
  const file = path.join(__dirname, "public", url.pathname === "/" ? "index.html" : url.pathname);
  if (!file.startsWith(path.join(__dirname, "public"))) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", file.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain");
    res.end(data);
  });
}).listen(PORT, () => console.log(`চালু: http://localhost:${PORT}  (${API_URL ? "লাইভ API" : "ডেমো মোড"})`));
