const BASE_URL = "https://kv.minapp.xin";

export async function getKV(key) {
  const url = `${BASE_URL}/kv/${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`KV GET failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function putKV(key, value) {
  const url = `${BASE_URL}/kv/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) {
    throw new Error(`KV PUT failed: ${res.status}`);
  }
  return res.json();
}
