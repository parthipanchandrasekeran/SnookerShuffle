import { getStore } from "@netlify/blobs";

const colors = [
  { name: "Yellow", value: 2, hex: "#f0d23d", text: "#1d1a07" },
  { name: "Green", value: 3, hex: "#0b8e45", text: "#ffffff" },
  { name: "Brown", value: 4, hex: "#75431c", text: "#ffffff" },
  { name: "Blue", value: 5, hex: "#256bd8", text: "#ffffff" },
  { name: "Pink", value: 6, hex: "#eb6fa8", text: "#27101a" },
  { name: "Black", value: 7, hex: "#080808", text: "#ffffff" }
];

const pockets = [
  { id: "top-left", label: "Top left", group: "corner" },
  { id: "top-right", label: "Top right", group: "corner" },
  { id: "bottom-left", label: "Bottom left", group: "corner" },
  { id: "bottom-right", label: "Bottom right", group: "corner" },
  { id: "top-middle", label: "Top middle", group: "middle" },
  { id: "bottom-middle", label: "Bottom middle", group: "middle" }
];

const store = getStore("snooker-shuffle-rooms");

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return response({});
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "state";
    const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));

    if (request.method === "POST" && action === "create") {
      return response(await createRoom(body));
    }

    const roomCode = normalizeRoomCode(body.roomCode || url.searchParams.get("roomCode"));
    if (!roomCode) return response({ error: "Room code is required." }, 400);

    const room = await getRoom(roomCode);
    if (!room) return response({ error: "Room not found." }, 404);

    if (request.method === "GET" || action === "state") {
      return response({ room: sanitizeRoom(room, body.playerToken || url.searchParams.get("playerToken")) });
    }

    const result = await runAction(room, action, body);
    await saveRoom(result.room);
    return response({ room: sanitizeRoom(result.room, body.playerToken || body.hostToken), ...result.extra });
  } catch (error) {
    return response({ error: error.message || "Something went wrong." }, 500);
  }
}

async function createRoom(body) {
  const roomCode = await createUniqueRoomCode();
  const hostToken = token();
  const players = normalizeNames(body.players || [body.hostName || "Host"]).map(createPlayer);
  const room = {
    roomCode,
    hostToken,
    phase: "setup",
    rules: {
      autoReds: true,
      redsRequired: redsNeeded(players.length),
      winningPockets: "corners-only"
    },
    players,
    targetPool: [...colors],
    pottedColors: [],
    winner: null,
    log: [`Room ${roomCode} created.`],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await saveRoom(room);
  return { room: sanitizeRoom(room, hostToken), hostToken };
}

async function runAction(room, action, body) {
  if (action === "join") {
    assertSetup(room);
    const player = createPlayer(normalizeName(body.name || "Player"));
    if (room.players.length >= 6) throw new Error("Room is full.");
    room.players.push(player);
    updateReds(room);
    log(room, `${player.name} joined.`);
    return { room, extra: { playerToken: player.token, playerId: player.id } };
  }

  const actor = findActor(room, body);

  if (action === "addPlayer") {
    assertHost(actor);
    assertSetup(room);
    if (room.players.length >= 6) throw new Error("Room is full.");
    const player = createPlayer(normalizeName(body.name || "Player"));
    room.players.push(player);
    updateReds(room);
    log(room, `${player.name} added.`);
    return { room, extra: { playerToken: player.token, playerId: player.id } };
  }

  if (action === "removePlayer") {
    assertHost(actor);
    assertSetup(room);
    room.players = room.players.filter((player) => player.id !== body.playerId);
    updateReds(room);
    log(room, "Player removed.");
    return { room, extra: {} };
  }

  if (action === "updateRules") {
    assertHost(actor);
    assertSetup(room);
    room.rules.autoReds = Boolean(body.autoReds);
    room.rules.redsRequired = Number(body.redsRequired) || redsNeeded(room.players.length);
    log(room, `Reds set to ${room.rules.redsRequired}.`);
    return { room, extra: {} };
  }

  if (action === "drawOrder") {
    assertHost(actor);
    assertSetup(room);
    if (room.players.length < 2 || room.players.length > 6) throw new Error("Add 2 to 6 players first.");
    const orderColors = shuffle(colors).slice(0, room.players.length);
    room.players = room.players
      .map((player, index) => ({
        ...player,
        orderColor: orderColors[index],
        status: "needs-reds",
        targetColor: null,
        targetPocket: null
      }))
      .sort((a, b) => b.orderColor.value - a.orderColor.value);
    room.phase = "playing";
    room.targetPool = [...colors];
    log(room, "Start order drawn.");
    return { room, extra: {} };
  }

  if (action === "drawTarget") {
    assertPlaying(room);
    const player = findPlayerByToken(room, body.playerToken) || findPlayer(room, body.playerId);
    if (!player) throw new Error("Player not found.");
    if (player.targetColor) throw new Error("This player already has a target.");
    if (room.targetPool.length === 0) throw new Error("No target colors left.");
    const drawnColor = shuffle(room.targetPool)[0];
    const drawnPocket = shuffle(pocketsForColor(drawnColor))[0];
    room.targetPool = room.targetPool.filter((color) => color.name !== drawnColor.name);
    player.targetColor = drawnColor;
    player.targetPocket = drawnPocket;
    player.status = "target-drawn";
    log(room, `${player.name} drew a private target.`);
    return { room, extra: {} };
  }

  if (action === "markColorPotted") {
    assertHost(actor);
    assertPlaying(room);
    const color = colors.find((item) => item.name === body.colorName);
    if (!color) throw new Error("Color not found.");
    if (!room.pottedColors.includes(color.name)) room.pottedColors.push(color.name);
    room.players.forEach((player) => {
      if (player.targetColor?.name === color.name && player.status !== "winner") {
        player.status = "out";
      }
    });
    log(room, `${color.name} marked potted.`);
    return { room, extra: {} };
  }

  if (action === "claimWin") {
    assertPlaying(room);
    const player = findPlayerByToken(room, body.playerToken) || findPlayer(room, body.playerId);
    if (!player?.targetColor || !player?.targetPocket) throw new Error("Player has no target.");
    const validColor = body.colorName === player.targetColor.name;
    const validPocket = body.pocketId === player.targetPocket.id;
    if (!validColor || !validPocket) throw new Error("Claim does not match the private target.");
    player.status = "winner";
    room.phase = "complete";
    room.winner = { playerId: player.id, name: player.name, color: player.targetColor, pocket: player.targetPocket };
    log(room, `${player.name} won with ${player.targetColor.name} in ${player.targetPocket.label}.`);
    return { room, extra: {} };
  }

  if (action === "reset") {
    assertHost(actor);
    room.phase = "setup";
    room.players = room.players.map((player) => ({
      ...player,
      orderColor: null,
      targetColor: null,
      targetPocket: null,
      status: "setup"
    }));
    room.targetPool = [...colors];
    room.pottedColors = [];
    room.winner = null;
    updateReds(room);
    log(room, "Game reset.");
    return { room, extra: {} };
  }

  throw new Error("Unsupported action.");
}

function sanitizeRoom(room, viewerToken) {
  const isHost = viewerToken === room.hostToken;
  return {
    roomCode: room.roomCode,
    phase: room.phase,
    rules: room.rules,
    pottedColors: room.pottedColors,
    winner: room.winner,
    isHost,
    players: room.players.map((player) => {
      const canSeeSecret = viewerToken === player.token || room.phase === "complete";
      return {
        id: player.id,
        name: player.name,
        orderColor: player.orderColor,
        status: player.status,
        hasTarget: Boolean(player.targetColor),
        targetColor: canSeeSecret ? player.targetColor : null,
        targetPocket: canSeeSecret ? player.targetPocket : null
      };
    }),
    log: room.log.slice(-12),
    updatedAt: room.updatedAt
  };
}

async function createUniqueRoomCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = Math.random().toString(36).slice(2, 6).toUpperCase();
    if (!(await getRoom(code))) return code;
  }
  throw new Error("Could not create a room code.");
}

async function getRoom(roomCode) {
  return store.get(roomCode, { type: "json", consistency: "strong" });
}

async function saveRoom(room) {
  room.updatedAt = new Date().toISOString();
  await store.setJSON(room.roomCode, room);
}

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}

function createPlayer(name) {
  return {
    id: token(10),
    token: token(24),
    name,
    orderColor: null,
    targetColor: null,
    targetPocket: null,
    status: "setup"
  };
}

function findActor(room, body) {
  if (body.hostToken === room.hostToken) return { role: "host" };
  const player = findPlayerByToken(room, body.playerToken);
  return player ? { role: "player", player } : { role: "guest" };
}

function findPlayerByToken(room, playerToken) {
  return room.players.find((player) => player.token === playerToken);
}

function findPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId);
}

function assertHost(actor) {
  if (actor.role !== "host") throw new Error("Host action required.");
}

function assertSetup(room) {
  if (room.phase !== "setup") throw new Error("This can only be changed during setup.");
}

function assertPlaying(room) {
  if (room.phase !== "playing") throw new Error("The game is not active.");
}

function updateReds(room) {
  if (room.rules.autoReds) room.rules.redsRequired = redsNeeded(room.players.length);
}

function redsNeeded(count) {
  if (count === 2) return 3;
  if (count === 3 || count === 4) return 2;
  if (count >= 5) return 1;
  return 0;
}

function normalizeNames(names) {
  return names.map(normalizeName).filter(Boolean).slice(0, 6);
}

function normalizeName(name) {
  return String(name).trim().slice(0, 18);
}

function normalizeRoomCode(roomCode) {
  return roomCode ? String(roomCode).trim().toUpperCase().slice(0, 6) : "";
}

function shuffle(list) {
  const output = [...list];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function pocketsForColor(color) {
  const group = color.name === "Blue" ? "middle" : "corner";
  return pockets.filter((pocket) => pocket.group === group);
}

function token(length = 16) {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((value) => value.toString(36).padStart(2, "0").slice(-2))
    .join("")
    .slice(0, length);
}

function log(room, message) {
  room.log.push(message);
}
