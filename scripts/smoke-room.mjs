// Room server smoke test. Requires the party worker running (npm run dev:party).
// Usage: node scripts/smoke-room.mjs [host]   (default localhost:8787)
// Uses an isolated room so it never disturbs players in the main "prometheus" room.

const host = process.argv[2] ?? "localhost:8787";
const protocol = /^(localhost|127\.0\.0\.1)/.test(host) ? "ws" : "wss";
const room = `smoke-test-${Date.now()}`;
const MAX_PLAYERS = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "✔" : "✘"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

function connect(username) {
  const ws = new WebSocket(`${protocol}://${host}/parties/prometheus-room/${room}?username=${encodeURIComponent(username)}`);
  const client = { ws, username, messages: [], closeCode: null };
  ws.addEventListener("message", (e) => client.messages.push(JSON.parse(e.data)));
  ws.addEventListener("close", (e) => (client.closeCode = e.code));
  client.opened = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  client.send = (msg) => ws.send(JSON.stringify(msg));
  client.of = (type) => client.messages.filter((m) => m.type === type);
  return client;
}

const clients = [];
for (let i = 1; i <= MAX_PLAYERS; i++) {
  const c = connect(i === 2 ? "bot-1" : `bot-${i}`); // bot-2 deliberately collides with bot-1's name
  await c.opened;
  clients.push(c);
  await sleep(40);
}
await sleep(300);

const [first, second] = clients;
check("welcome received by all 10", clients.every((c) => c.of("welcome").length === 1));
check("duplicate username de-duplicated", second.of("welcome")[0]?.username === "bot-1#2", second.of("welcome")[0]?.username);
check(
  "join system messages broadcast",
  first.of("chat").filter((m) => m.message.kind === "system" && m.message.text.endsWith("has connected to the simulation.")).length === MAX_PLAYERS,
);

// 11th player is rejected.
const overflow = connect("bot-overflow");
await overflow.opened;
await sleep(400);
check("11th client receives room-full", overflow.of("room-full").length === 1);
check("11th client is closed with 4001", overflow.closeCode === 4001, `code ${overflow.closeCode}`);

// State relay with the spec payload shape.
first.send({ type: "state", x: 1.5, y: 0, z: -3, rotY: 0.7, isMoving: true });
await sleep(200);
const relayed = second.of("state").at(-1);
check(
  "state relayed as { id, username, x, y, z, rotY, isMoving }",
  relayed && relayed.username === "bot-1" && relayed.x === 1.5 && relayed.isMoving === true && typeof relayed.id === "string",
);
check("sender does not receive its own state", first.of("state").length === 0);

// Forged admin commands are ignored without auth.
first.send({ type: "admin-announce", text: "forged" });
first.send({ type: "admin-say", text: "[Overseer]: forged" });
first.send({ type: "admin-teleport", target: "all" });
await sleep(300);
check("unauthenticated announce ignored", !second.of("chat").some((m) => m.message.kind === "admin"));
check("unauthenticated admin-say ignored", !second.of("chat").some((m) => m.message.kind === "admin-chat"));
check("unauthenticated teleport ignored", second.of("teleport").length === 0);

// Real admin flow.
first.send({ type: "admin-auth", username: "admin", password: "nope" });
await sleep(200);
check("wrong password rejected", first.of("admin-auth-result").at(-1)?.ok === false);
first.send({ type: "admin-auth", username: "admin", password: "password" });
await sleep(200);
check("correct password accepted", first.of("admin-auth-result").at(-1)?.ok === true);
first.send({ type: "admin-announce", text: "Attention, travelers." });
first.send({ type: "admin-teleport", target: "all" });
await sleep(300);
check("admin announcement broadcast", second.of("chat").some((m) => m.message.kind === "admin" && m.message.text === "Attention, travelers."));
check("teleport-all delivered", clients.every((c) => c.of("teleport").length === 1));

// Admin chat-style messages: no banner kind, optional speaker label.
const bannersBefore = second.of("chat").filter((m) => m.message.kind === "admin").length;
first.send({ type: "admin-say", text: "[admin]: hello world" });
first.send({ type: "admin-say", text: "no prefix here" });
await sleep(300);
const adminChats = second.of("chat").filter((m) => m.message.kind === "admin-chat").map((m) => m.message);
check(
  "admin-say with [label]: uses the label as speaker",
  adminChats.some((m) => m.from === "admin" && m.text === "hello world"),
  JSON.stringify(adminChats[0]),
);
check("admin-say without prefix is sent as the admin's own name", adminChats.some((m) => m.from === "bot-1" && m.text === "no prefix here"));
check("admin-say is not a broadcast", second.of("chat").filter((m) => m.message.kind === "admin").length === bannersBefore);

// Chat + leave.
second.send({ type: "chat", text: "  hello\n world  " });
await sleep(200);
check("chat relayed and sanitized", first.of("chat").some((m) => m.message.kind === "user" && m.message.text === "hello world"));
clients.at(-1).ws.close();
await sleep(300);
check(
  "departure system message broadcast",
  first.of("chat").some((m) => m.message.kind === "system" && m.message.text === "bot-10 has departed the simulation."),
);
check("player-left broadcast", first.of("player-left").length === 1);

for (const c of clients) c.ws.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll room checks passed");
process.exit(failures ? 1 : 0);
