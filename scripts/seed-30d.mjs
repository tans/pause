const BASE_URL = "https://kv.minapp.xin";
const MOTIVES = ["灵感", "放松", "心痒", "无聊", "社交", "疲倦"];

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/seed-30d.mjs <email>");
    process.exit(1);
  }

  const key = `pause:${email}`;
  const existing = await getKV(key);
  const base = normalizeUserData(email, existing);

  const now = new Date();
  const sessions = [];
  for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - dayOffset);

    const count = randInt(0, 4); // 0-3
    for (let i = 0; i < count; i += 1) {
      const startedAt = randomTimeOnDate(date);
      const durationMs = randInt(2, 7) * 60 * 1000;
      const endedAt = startedAt + durationMs;
      sessions.push({
        id: makeId(),
        startedAt,
        endedAt,
        motive: MOTIVES[randInt(0, MOTIVES.length)],
        durationMs,
        feeling: null,
      });
    }
  }

  sessions.sort((a, b) => b.startedAt - a.startedAt);

  const nextData = {
    ...base,
    lastMotivation: sessions[0]?.motive || base.lastMotivation,
    sessions: [...sessions, ...(base.sessions || [])].slice(0, 200),
    updatedAt: Date.now(),
  };

  await putKV(key, nextData);
  console.log(`Seeded 30-day sessions for ${email}`);
}

async function getKV(key) {
  const url = `${BASE_URL}/kv/${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KV GET failed: ${res.status}`);
  return res.json();
}

async function putKV(key, value) {
  const url = `${BASE_URL}/kv/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`KV PUT failed: ${res.status}`);
  return res.json();
}

function normalizeUserData(email, data) {
  if (!data || typeof data !== "object") {
    return {
      email,
      sessions: [],
      lastMotivation: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
  return {
    email,
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    lastMotivation: data.lastMotivation || "",
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

function randomTimeOnDate(date) {
  const d = new Date(date);
  d.setHours(randInt(8, 23), randInt(0, 60), randInt(0, 60), 0);
  return d.getTime();
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
