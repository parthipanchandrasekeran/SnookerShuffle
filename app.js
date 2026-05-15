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

const sampleNames = ["Ali", "Sam", "Raj", "Mina"];
const apiBase = "/.netlify/functions/game";
const isFileMode = location.protocol === "file:";

let mode = "local";
let session = loadSession();
let activePlayerId = null;
let state = createLocalRoom();
let pollTimer = null;

const dom = {
  localMode: document.querySelector("#localMode"),
  roomMode: document.querySelector("#roomMode"),
  modeText: document.querySelector("#modeText"),
  roomTools: document.querySelector("#roomTools"),
  roomName: document.querySelector("#roomName"),
  roomCodeInput: document.querySelector("#roomCodeInput"),
  createRoom: document.querySelector("#createRoom"),
  joinRoom: document.querySelector("#joinRoom"),
  roomCodeBox: document.querySelector("#roomCodeBox"),
  roomCodeText: document.querySelector("#roomCodeText"),
  playerForm: document.querySelector("#playerForm"),
  playerName: document.querySelector("#playerName"),
  samplePlayers: document.querySelector("#samplePlayers"),
  playerList: document.querySelector("#playerList"),
  redRequirement: document.querySelector("#redRequirement"),
  autoReds: document.querySelector("#autoReds"),
  manualReds: document.querySelector("#manualReds"),
  drawOrder: document.querySelector("#drawOrder"),
  gameTitle: document.querySelector("#gameTitle"),
  statusPill: document.querySelector("#statusPill"),
  hostTools: document.querySelector("#hostTools"),
  colorControls: document.querySelector("#colorControls"),
  winnerBanner: document.querySelector("#winnerBanner"),
  gameGrid: document.querySelector("#gameGrid"),
  eventLog: document.querySelector("#eventLog"),
  privacyOverlay: document.querySelector("#privacyOverlay"),
  privacyScreen: document.querySelector("#privacyScreen"),
  targetScreen: document.querySelector("#targetScreen"),
  revealTarget: document.querySelector("#revealTarget"),
  hideTarget: document.querySelector("#hideTarget"),
  claimWin: document.querySelector("#claimWin"),
  targetPlayer: document.querySelector("#targetPlayer"),
  targetBall: document.querySelector("#targetBall"),
  targetText: document.querySelector("#targetText"),
  targetPocketText: document.querySelector("#targetPocketText"),
  resetGame: document.querySelector("#resetGame")
};

function createLocalRoom() {
  return {
    roomCode: "",
    phase: "setup",
    isHost: true,
    rules: { autoReds: true, redsRequired: 0, winningPockets: "corners-only" },
    players: [],
    targetPool: [...colors],
    pottedColors: [],
    winner: null,
    log: ["Local game ready."]
  };
}

function createLocalPlayer(name) {
  return {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    name,
    orderColor: null,
    status: "setup",
    hasTarget: false,
    targetColor: null,
    targetPocket: null
  };
}

function redsNeeded(count) {
  if (count === 2) return 3;
  if (count === 3 || count === 4) return 2;
  if (count >= 5) return 1;
  return 0;
}

function displayReds() {
  const count = state.rules.redsRequired || redsNeeded(state.players.length);
  if (!count) return "Add players";
  return `${count} red${count === 1 ? "" : "s"}`;
}

function setMode(nextMode) {
  mode = nextMode;
  dom.localMode.classList.toggle("is-active", mode === "local");
  dom.roomMode.classList.toggle("is-active", mode === "room");
  dom.roomTools.classList.toggle("hidden", mode !== "room");
  dom.modeText.textContent = mode === "room" ? "Netlify room mode" : "Single-device mode";
  if (mode === "local") {
    stopPolling();
    state = createLocalRoom();
    session = {};
    saveSession();
  } else if (session.roomCode && !isFileMode) {
    refreshRoom();
    startPolling();
  }
  render();
}

function render() {
  const canHost = mode === "local" || state.isHost;
  const inSetup = state.phase === "setup";
  const roomActive = mode === "room" && Boolean(state.roomCode);

  dom.roomCodeBox.classList.toggle("hidden", !roomActive);
  dom.roomCodeText.textContent = state.roomCode || "----";
  dom.playerForm.classList.toggle("hidden", mode === "room" && !state.isHost);
  dom.samplePlayers.disabled = !canHost || !inSetup;
  dom.drawOrder.disabled = !canHost || !inSetup || state.players.length < 2 || state.players.length > 6;
  dom.playerName.disabled = !canHost || !inSetup;
  dom.autoReds.checked = Boolean(state.rules.autoReds);
  dom.manualReds.value = state.rules.redsRequired || redsNeeded(state.players.length) || 2;
  dom.autoReds.disabled = !canHost || !inSetup;
  dom.manualReds.disabled = !canHost || !inSetup || dom.autoReds.checked;
  dom.redRequirement.textContent = displayReds();
  dom.gameTitle.textContent = titleForPhase();
  dom.statusPill.textContent = pillForPhase();

  renderPlayers(canHost, inSetup);
  renderHostTools(canHost);
  renderGameGrid();
  renderWinner();
  renderLog();
}

function titleForPhase() {
  if (state.phase === "complete") return "Game complete";
  if (state.phase === "playing") return "Game in play";
  return "Set up the game";
}

function pillForPhase() {
  if (state.phase === "complete") return "Winner";
  if (state.phase === "playing") return `${displayReds()} to qualify`;
  return mode === "room" && isFileMode ? "Deploy for rooms" : "Waiting";
}

function renderPlayers(canHost, inSetup) {
  dom.playerList.innerHTML = "";
  if (state.players.length === 0) {
    dom.playerList.innerHTML = `<div class="empty-list">No players added yet.</div>`;
    return;
  }

  state.players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "player-row";
    const remove = canHost && inSetup ? `<button class="remove-button" data-remove="${player.id}" type="button">Remove</button>` : "";
    const status = player.orderColor ? `<span class="mini-status">${player.orderColor.name} ${player.orderColor.value}</span>` : `<span class="mini-status">${formatStatus(player.status)}</span>`;
    row.innerHTML = `<span>${escapeText(player.name)}</span>${status}${remove}`;
    dom.playerList.append(row);
  });
}

function renderHostTools(canHost) {
  dom.hostTools.classList.toggle("hidden", !canHost || state.phase !== "playing");
  dom.colorControls.innerHTML = "";
  colors.forEach((color) => {
    const button = document.createElement("button");
    button.className = "color-control";
    button.type = "button";
    button.style.cssText = colorStyle(color);
    button.dataset.pottedColor = color.name;
    button.disabled = state.pottedColors.includes(color.name);
    button.textContent = state.pottedColors.includes(color.name) ? `${color.name} potted` : `Mark ${color.name}`;
    dom.colorControls.append(button);
  });
}

function renderGameGrid() {
  dom.gameGrid.innerHTML = "";
  if (state.phase === "setup") {
    dom.gameGrid.innerHTML = `<div class="empty-state"><h3>Add players, then draw the order.</h3><p>Highest color starts. Players draw targets privately after qualifying.</p></div>`;
    return;
  }

  state.players.forEach((player, index) => {
    const card = document.createElement("article");
    card.className = "order-card";
    const ownSecret = player.targetColor && player.targetPocket;
    const action = actionForPlayer(player, ownSecret);
    card.innerHTML = `
      <div class="order-meta">
        <small>Turn ${index + 1}</small>
        <strong>${escapeText(player.name)}</strong>
        ${player.orderColor ? `<span class="color-pill" style="${colorStyle(player.orderColor)}">${player.orderColor.name} ${player.orderColor.value}</span>` : ""}
        <span class="drawn-note">${formatStatus(player.status)}</span>
      </div>
      <div class="card-actions">${action}</div>
    `;
    dom.gameGrid.append(card);
  });
}

function actionForPlayer(player, ownSecret) {
  if (state.phase === "complete") return "";
  const isOwnRoomPlayer = mode === "room" && session.playerId === player.id;
  const canDrawForPlayer = mode === "local" || isOwnRoomPlayer;
  if (mode === "room" && state.isHost && !ownSecret) {
    return `<span class="drawn-note">${player.hasTarget ? "Target hidden" : "Player draws on their phone"}</span>`;
  }
  if (mode === "room" && !state.isHost && !isOwnRoomPlayer) {
    return `<span class="drawn-note">${player.hasTarget ? "Target hidden" : "Waiting"}</span>`;
  }
  if (player.status === "out") {
    return `<span class="drawn-note">Out</span>`;
  }
  if (ownSecret) {
    return `<button class="qualify-button" data-show-target="${player.id}" type="button">Show my target</button>`;
  }
  if (player.hasTarget) {
    return `<span class="drawn-note">Target hidden</span>`;
  }
  return canDrawForPlayer
    ? `<button class="qualify-button" data-private-draw="${player.id}" type="button">Qualified: draw target</button>`
    : `<span class="drawn-note">Waiting</span>`;
}

function renderWinner() {
  dom.winnerBanner.classList.toggle("hidden", !state.winner);
  if (!state.winner) return;
  dom.winnerBanner.textContent = `${state.winner.name} wins with ${state.winner.color.name} in the ${state.winner.pocket.label.toLowerCase()} pocket.`;
}

function renderLog() {
  dom.eventLog.innerHTML = state.log.map((item) => `<span>${escapeText(item)}</span>`).join("");
}

async function createRoom() {
  if (isFileMode) return alert("Room mode works after the site is deployed to Netlify.");
  const hostName = dom.roomName.value.trim() || "Host";
  const payload = await api("create", { hostName }, true);
  session = { roomCode: payload.room.roomCode, hostToken: payload.hostToken };
  state = payload.room;
  saveSession();
  startPolling();
  render();
}

async function joinRoom() {
  if (isFileMode) return alert("Room mode works after the site is deployed to Netlify.");
  const name = dom.roomName.value.trim() || "Player";
  const roomCode = dom.roomCodeInput.value.trim().toUpperCase();
  const payload = await api("join", { roomCode, name }, true);
  session = { roomCode, playerToken: payload.playerToken, playerId: payload.playerId };
  state = payload.room;
  saveSession();
  startPolling();
  render();
}

async function refreshRoom() {
  if (!session.roomCode || isFileMode) return;
  const token = session.hostToken || session.playerToken || "";
  const result = await fetch(`${apiBase}?roomCode=${encodeURIComponent(session.roomCode)}&playerToken=${encodeURIComponent(token)}`);
  const payload = await result.json();
  if (payload.room) {
    state = payload.room;
    render();
  }
}

async function runRemoteAction(action, body = {}) {
  const payload = await api(action, {
    roomCode: session.roomCode,
    hostToken: session.hostToken,
    playerToken: session.playerToken,
    ...body
  });
  state = payload.room;
  render();
}

async function api(action, body, allowNoSession = false) {
  if (!allowNoSession && mode === "room" && !session.roomCode) throw new Error("No room joined.");
  const result = await fetch(`${apiBase}?action=${encodeURIComponent(action)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await result.json();
  if (!result.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function startPolling() {
  stopPolling();
  pollTimer = window.setInterval(refreshRoom, 3000);
}

function stopPolling() {
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = null;
}

function addLocalPlayer(name) {
  if (state.phase !== "setup" || state.players.length >= 6) return;
  state.players.push(createLocalPlayer(name));
  updateLocalReds();
  state.log.push(`${name} added.`);
}

function updateLocalReds() {
  if (state.rules.autoReds) state.rules.redsRequired = redsNeeded(state.players.length);
}

function drawLocalOrder() {
  const orderColors = shuffle(colors).slice(0, state.players.length);
  state.players = state.players
    .map((player, index) => ({ ...player, orderColor: orderColors[index], status: "needs-reds", targetColor: null, targetPocket: null, hasTarget: false }))
    .sort((a, b) => b.orderColor.value - a.orderColor.value);
  state.phase = "playing";
  state.targetPool = [...colors];
  state.log.push("Start order drawn.");
}

function localDrawTarget(playerId) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || state.targetPool.length === 0) return;
  const drawnColor = shuffle(state.targetPool)[0];
  const drawnPocket = shuffle(pocketsForColor(drawnColor))[0];
  state.targetPool = state.targetPool.filter((color) => color.name !== drawnColor.name);
  player.targetColor = drawnColor;
  player.targetPocket = drawnPocket;
  player.hasTarget = true;
  player.status = "target-drawn";
  state.log.push(`${player.name} drew a private target.`);
}

function showTarget(playerId) {
  activePlayerId = playerId;
  const player = state.players.find((item) => item.id === playerId);
  if (!player?.targetColor || !player?.targetPocket) return;
  revealKnownTarget(player);
}

function revealKnownTarget(player) {
  dom.targetPlayer.textContent = player.name;
  dom.targetBall.style.cssText = colorStyle(player.targetColor);
  dom.targetText.textContent = `${player.targetColor.name} ball`;
  dom.targetPocketText.textContent = `Pot it in the ${player.targetPocket.label.toLowerCase()} ${player.targetPocket.group} pocket.`;
  highlightPocket(player.targetPocket);
  dom.privacyOverlay.classList.remove("hidden");
  dom.privacyScreen.classList.add("hidden");
  dom.targetScreen.classList.remove("hidden");
}

async function openPrivateDraw(playerId) {
  activePlayerId = playerId;
  clearPocketHighlights();
  if (mode === "local") {
    localDrawTarget(playerId);
    render();
  } else {
    await runRemoteAction("drawTarget", { playerId });
  }
  dom.privacyOverlay.classList.remove("hidden");
  dom.privacyScreen.classList.remove("hidden");
  dom.targetScreen.classList.add("hidden");
}

function revealPrivateTarget() {
  const player = state.players.find((item) => item.id === activePlayerId);
  if (player?.targetColor && player?.targetPocket) revealKnownTarget(player);
}

async function markColorPotted(colorName) {
  if (mode === "room") {
    await runRemoteAction("markColorPotted", { colorName });
    return;
  }
  if (!state.pottedColors.includes(colorName)) state.pottedColors.push(colorName);
  state.players.forEach((player) => {
    if (player.targetColor?.name === colorName && player.status !== "winner") player.status = "out";
  });
  state.log.push(`${colorName} marked potted.`);
  render();
}

async function claimWin() {
  const player = state.players.find((item) => item.id === activePlayerId);
  if (!player?.targetColor || !player?.targetPocket) return;
  if (mode === "room") {
    await runRemoteAction("claimWin", { playerId: player.id, colorName: player.targetColor.name, pocketId: player.targetPocket.id });
  } else {
    player.status = "winner";
    state.phase = "complete";
    state.winner = { playerId: player.id, name: player.name, color: player.targetColor, pocket: player.targetPocket };
    state.log.push(`${player.name} won.`);
    render();
  }
  hidePrivateTarget();
}

function hidePrivateTarget() {
  activePlayerId = null;
  dom.privacyOverlay.classList.add("hidden");
  dom.privacyScreen.classList.remove("hidden");
  dom.targetScreen.classList.add("hidden");
  clearPocketHighlights();
}

function highlightPocket(pocket) {
  document.querySelectorAll("[data-pocket-marker]").forEach((marker) => {
    marker.classList.toggle("is-assigned", marker.dataset.pocketMarker === pocket.id);
  });
}

function clearPocketHighlights() {
  document.querySelectorAll("[data-pocket-marker]").forEach((element) => element.classList.remove("is-assigned"));
}

function resetAll() {
  if (mode === "room" && session.roomCode) {
    runRemoteAction("reset").catch(showError);
    return;
  }
  state = createLocalRoom();
  session = {};
  saveSession();
  hidePrivateTarget();
  render();
}

function saveSession() {
  localStorage.setItem("snookerShuffleSession", JSON.stringify(session));
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem("snookerShuffleSession")) || {};
  } catch {
    return {};
  }
}

function formatStatus(status) {
  return {
    setup: "Setup",
    "needs-reds": "Needs reds",
    "target-drawn": "Target hidden",
    out: "Out",
    winner: "Winner"
  }[status] || "Ready";
}

function colorStyle(color) {
  return `background:${color.hex};color:${color.text}`;
}

function pocketsForColor(color) {
  const group = color.name === "Blue" ? "middle" : "corner";
  return pockets.filter((pocket) => pocket.group === group);
}

function shuffle(list) {
  const output = [...list];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function escapeText(value) {
  const span = document.createElement("span");
  span.textContent = value || "";
  return span.innerHTML;
}

function showError(error) {
  alert(error.message || "Something went wrong.");
}

dom.localMode.addEventListener("click", () => setMode("local"));
dom.roomMode.addEventListener("click", () => setMode("room"));
dom.createRoom.addEventListener("click", () => createRoom().catch(showError));
dom.joinRoom.addEventListener("click", () => joinRoom().catch(showError));
dom.playerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = dom.playerName.value.trim();
  if (!name) return;
  try {
    if (mode === "room") await runRemoteAction("addPlayer", { name });
    else addLocalPlayer(name);
    dom.playerName.value = "";
    render();
  } catch (error) {
    showError(error);
  }
});
dom.samplePlayers.addEventListener("click", async () => {
  try {
    if (mode === "room") {
      for (const name of sampleNames) await runRemoteAction("addPlayer", { name });
    } else {
      state = createLocalRoom();
      sampleNames.forEach(addLocalPlayer);
      render();
    }
  } catch (error) {
    showError(error);
  }
});
dom.drawOrder.addEventListener("click", async () => {
  try {
    if (mode === "room") await runRemoteAction("drawOrder");
    else drawLocalOrder();
    render();
  } catch (error) {
    showError(error);
  }
});
dom.playerList.addEventListener("click", async (event) => {
  const removeId = event.target.dataset.remove;
  if (!removeId) return;
  if (mode === "room") await runRemoteAction("removePlayer", { playerId: removeId }).catch(showError);
  else {
    state.players = state.players.filter((player) => player.id !== removeId);
    updateLocalReds();
    render();
  }
});
dom.gameGrid.addEventListener("click", (event) => {
  const drawId = event.target.dataset.privateDraw;
  const showId = event.target.dataset.showTarget;
  if (drawId) openPrivateDraw(drawId).catch(showError);
  if (showId) showTarget(showId);
});
dom.colorControls.addEventListener("click", (event) => {
  if (event.target.dataset.pottedColor) markColorPotted(event.target.dataset.pottedColor).catch(showError);
});
dom.autoReds.addEventListener("change", async () => {
  state.rules.autoReds = dom.autoReds.checked;
  if (mode === "room") {
    await runRemoteAction("updateRules", {
      autoReds: dom.autoReds.checked,
      redsRequired: Number(dom.manualReds.value) || state.rules.redsRequired
    }).catch(showError);
    return;
  }
  updateLocalReds();
  render();
});
dom.manualReds.addEventListener("change", async () => {
  state.rules.redsRequired = Number(dom.manualReds.value) || 1;
  state.rules.autoReds = false;
  dom.autoReds.checked = false;
  if (mode === "room") {
    await runRemoteAction("updateRules", { autoReds: false, redsRequired: state.rules.redsRequired }).catch(showError);
    return;
  }
  render();
});
dom.revealTarget.addEventListener("click", revealPrivateTarget);
dom.hideTarget.addEventListener("click", hidePrivateTarget);
dom.claimWin.addEventListener("click", () => claimWin().catch(showError));
dom.resetGame.addEventListener("click", resetAll);

if (session.roomCode && !isFileMode) {
  mode = "room";
  setMode("room");
} else {
  render();
}
