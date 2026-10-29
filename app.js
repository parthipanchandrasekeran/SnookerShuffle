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

let mode = null;
let session = loadSession();
let linkCode = normalizeCode(new URLSearchParams(location.search).get("room"));
let activePlayerId = null;
let state = createLocalRoom();
let pollTimer = null;
const renderedHtml = new WeakMap();

const dom = {
  startScreen: document.querySelector("#startScreen"),
  startTitle: document.querySelector("#startTitle"),
  startName: document.querySelector("#startName"),
  createRoom: document.querySelector("#createRoom"),
  joinDivider: document.querySelector("#joinDivider"),
  roomCodeInput: document.querySelector("#roomCodeInput"),
  joinRoom: document.querySelector("#joinRoom"),
  playLocal: document.querySelector("#playLocal"),
  youCard: document.querySelector("#youCard"),
  gameLayout: document.querySelector("#gameLayout"),
  modeText: document.querySelector("#modeText"),
  roomCodeBox: document.querySelector("#roomCodeBox"),
  roomCodeText: document.querySelector("#roomCodeText"),
  roomInvite: document.querySelector("#roomInvite"),
  roomQr: document.querySelector("#roomQr"),
  shareRoom: document.querySelector("#shareRoom"),
  playerForm: document.querySelector("#playerForm"),
  playerName: document.querySelector("#playerName"),
  hostSetup: document.querySelector("#hostSetup"),
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
  privacyTitle: document.querySelector("#privacyTitle"),
  privacyCopy: document.querySelector("#privacyCopy"),
  targetScreen: document.querySelector("#targetScreen"),
  revealTarget: document.querySelector("#revealTarget"),
  hideTarget: document.querySelector("#hideTarget"),
  claimWin: document.querySelector("#claimWin"),
  targetPlayer: document.querySelector("#targetPlayer"),
  targetBall: document.querySelector("#targetBall"),
  targetText: document.querySelector("#targetText"),
  targetPocketText: document.querySelector("#targetPocketText"),
  resetGame: document.querySelector("#resetGame"),
  exitGame: document.querySelector("#exitGame")
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
  stopPolling();
  hidePrivateTarget();
  if (mode === "room") startPolling();
  render();
}

function render() {
  const inRoom = mode === "room";
  const canHost = mode === "local" || (inRoom && state.isHost);
  const inSetup = state.phase === "setup";

  document.body.classList.toggle("in-room", inRoom);
  dom.startScreen.classList.toggle("hidden", mode !== null);
  dom.gameLayout.classList.toggle("hidden", mode === null);
  dom.exitGame.classList.toggle("hidden", mode === null);
  dom.exitGame.textContent = inRoom ? "Leave room" : "Exit";
  dom.resetGame.classList.toggle("hidden", mode === null || !canHost);
  renderYouCard();

  if (mode === null) {
    renderStart();
    return;
  }

  dom.modeText.textContent = inRoom ? (state.isHost ? "You're hosting" : "Joined room") : "One shared device";
  dom.roomCodeBox.classList.toggle("hidden", !inRoom);
  dom.roomCodeText.textContent = state.roomCode || session.roomCode || "----";
  dom.roomInvite.classList.toggle("hidden", !inRoom || !inSetup);
  if (inRoom && inSetup) renderQr();
  dom.playerForm.classList.toggle("hidden", inRoom);
  dom.hostSetup.classList.toggle("hidden", !canHost || (inRoom && !inSetup));
  dom.samplePlayers.classList.toggle("hidden", inRoom);
  dom.samplePlayers.disabled = !inSetup;
  dom.drawOrder.disabled = !canHost || !inSetup || state.players.length < 2 || state.players.length > 6;
  dom.playerName.disabled = !inSetup;
  dom.autoReds.checked = Boolean(state.rules.autoReds);
  dom.manualReds.value = state.rules.redsRequired || redsNeeded(state.players.length) || 2;
  dom.autoReds.disabled = !canHost || !inSetup;
  dom.manualReds.disabled = !canHost || !inSetup || dom.autoReds.checked;
  dom.redRequirement.textContent = displayReds();
  dom.gameTitle.textContent = titleForPhase();
  dom.statusPill.textContent = pillForPhase();
  dom.privacyTitle.textContent = inRoom ? "Cover your screen" : "Hand the device to the player";
  dom.privacyCopy.textContent = inRoom
    ? "Your target is secret. Only you should see it."
    : "Only this player should tap reveal. Other players should look away.";
  dom.hideTarget.textContent = inRoom ? "Hide my target" : "Hide before passing";

  renderPlayers(canHost, inSetup);
  renderHostTools(canHost);
  renderGameGrid();
  renderWinner();
  renderLog();
}

function renderStart() {
  dom.startTitle.textContent = linkCode ? `Join room ${linkCode}` : "Play from your phones";
  dom.createRoom.classList.toggle("hidden", Boolean(linkCode));
  dom.joinDivider.classList.toggle("hidden", Boolean(linkCode));
  dom.joinRoom.classList.toggle("primary-action", Boolean(linkCode));
}

function renderYouCard() {
  const me = mode === "room" && session.playerId ? state.players.find((player) => player.id === session.playerId) : null;
  const show = mode === "room" && Boolean(state.updatedAt) && Boolean(session.playerId);
  dom.youCard.classList.toggle("hidden", !show);
  if (!show) return;

  let html;
  if (!me) {
    html = `<p class="eyebrow">You</p><h2>You're not in this room</h2><p class="you-text">The host may have removed you. Tap Leave room, then join again.</p>`;
  } else {
    const turn = state.players.indexOf(me) + 1;
    const pill = me.orderColor
      ? `<span class="color-pill" style="${colorStyle(me.orderColor)}">Turn ${turn} &middot; ${me.orderColor.name}</span>`
      : "";
    html = `<div class="you-head"><div><p class="eyebrow">You</p><h2>${escapeText(me.name)}</h2></div>${pill}</div>${youBody(me)}`;
  }
  setHtml(dom.youCard, html);
}

function youBody(me) {
  if (state.phase === "setup") {
    return state.isHost
      ? `<p class="you-text">Get everyone to scan the QR code or open your invite link. When everyone is in, tap <strong>Draw start order</strong>.</p>`
      : `<p class="you-text">You're in. Waiting for the host to draw the start order.</p>`;
  }
  if (state.phase === "complete") {
    const won = state.winner?.playerId === me.id;
    return `<p class="you-text">${won ? "You won!" : `${escapeText(state.winner?.name)} won this game.`}</p>`;
  }
  if (me.status === "out") {
    return `<p class="you-text">You're out. Your target colour was potted.</p>`;
  }
  if (me.targetColor) {
    return `<p class="you-text">Your target is hidden. Check it any time.</p><button class="primary-action big-action" data-you="show" type="button">Show my target</button>`;
  }
  const reds = displayReds();
  return `<p class="you-text">Pot ${reds} first, then draw your secret target.</p><button class="primary-action big-action" data-you="draw" type="button">I've potted ${reds}: draw my target</button>`;
}

function renderQr() {
  const url = inviteUrl();
  if (dom.roomQr.dataset.url === url || typeof qrcode !== "function") return;
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  dom.roomQr.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  dom.roomQr.dataset.url = url;
}

function inviteUrl() {
  return `${location.origin}${location.pathname}?room=${encodeURIComponent(state.roomCode)}`;
}

function titleForPhase() {
  if (state.phase === "complete") return "Game complete";
  if (state.phase === "playing") return "Game in play";
  return "Set up the game";
}

function pillForPhase() {
  if (state.phase === "complete") return "Winner";
  if (state.phase === "playing") return `${displayReds()} to qualify`;
  return "Waiting";
}

function renderPlayers(canHost, inSetup) {
  if (state.players.length === 0) {
    setHtml(dom.playerList, `<div class="empty-list">No players added yet.</div>`);
    return;
  }

  setHtml(dom.playerList, state.players.map((player) => {
    const isMe = mode === "room" && player.id === session.playerId;
    const remove = canHost && inSetup && !isMe ? `<button class="remove-button" data-remove="${player.id}" type="button">Remove</button>` : "";
    const status = player.orderColor ? `${player.orderColor.name} ${player.orderColor.value}` : formatStatus(player.status);
    return `<div class="player-row"><span>${escapeText(player.name)}${isMe ? " (you)" : ""}</span><span class="mini-status">${status}</span>${remove}</div>`;
  }).join(""));
}

function renderHostTools(canHost) {
  dom.hostTools.classList.toggle("hidden", !canHost || state.phase !== "playing");
  setHtml(dom.colorControls, colors.map((color) => {
    const potted = state.pottedColors.includes(color.name);
    return `<button class="color-control" type="button" style="${colorStyle(color)}" data-potted-color="${color.name}"${potted ? " disabled" : ""}>${potted ? `${color.name} potted` : `Mark ${color.name}`}</button>`;
  }).join(""));
}

function renderGameGrid() {
  if (state.phase === "setup") {
    const hint = mode === "room"
      ? "Everyone joins on their own phone. The host draws the start order."
      : "Highest color starts. Players draw targets privately after qualifying.";
    setHtml(dom.gameGrid, `<div class="empty-state"><h3>Waiting for the start order.</h3><p>${hint}</p></div>`);
    return;
  }

  setHtml(dom.gameGrid, state.players.map((player, index) => `
    <article class="order-card">
      <div class="order-meta">
        <small>Turn ${index + 1}</small>
        <strong>${escapeText(player.name)}</strong>
        ${player.orderColor ? `<span class="color-pill" style="${colorStyle(player.orderColor)}">${player.orderColor.name} ${player.orderColor.value}</span>` : ""}
        <span class="drawn-note">${formatStatus(player.status)}</span>
      </div>
      <div class="card-actions">${actionForPlayer(player)}</div>
    </article>
  `).join(""));
}

function actionForPlayer(player) {
  if (state.phase === "complete") return "";
  if (mode === "room") {
    if (player.id === session.playerId) return `<span class="drawn-note">You</span>`;
    return `<span class="drawn-note">${player.hasTarget ? "Target hidden" : "Draws on their phone"}</span>`;
  }
  if (player.status === "out") return `<span class="drawn-note">Out</span>`;
  if (player.targetColor && player.targetPocket) {
    return `<button class="qualify-button" data-show-target="${player.id}" type="button">Show my target</button>`;
  }
  return `<button class="qualify-button" data-private-draw="${player.id}" type="button">Qualified: draw target</button>`;
}

function renderWinner() {
  dom.winnerBanner.classList.toggle("hidden", !state.winner);
  if (!state.winner) return;
  dom.winnerBanner.textContent = `${state.winner.name} wins with ${state.winner.color.name} in the ${pocketName(state.winner.pocket)}.`;
}

function renderLog() {
  setHtml(dom.eventLog, state.log.map((item) => `<span>${escapeText(item)}</span>`).join(""));
}

function setHtml(element, html) {
  if (renderedHtml.get(element) === html) return;
  element.innerHTML = html;
  renderedHtml.set(element, html);
}

async function createRoom() {
  if (isFileMode) return alert("Room mode works after the site is deployed to Netlify.");
  if (!dom.startName.reportValidity()) return;
  const payload = await api("create", { hostName: dom.startName.value.trim() });
  enterRoom(payload, { hostToken: payload.hostToken });
}

async function joinRoom() {
  if (isFileMode) return alert("Room mode works after the site is deployed to Netlify.");
  if (!dom.startName.reportValidity()) return;
  const roomCode = normalizeCode(dom.roomCodeInput.value);
  if (!roomCode) {
    dom.roomCodeInput.focus();
    return;
  }
  const payload = await api("join", { roomCode, name: dom.startName.value.trim() });
  enterRoom(payload);
}

function enterRoom(payload, extra = {}) {
  session = { roomCode: payload.room.roomCode, playerToken: payload.playerToken, playerId: payload.playerId, ...extra };
  state = payload.room;
  saveSession();
  clearLink();
  setMode("room");
}

function leaveGame() {
  if (mode === "room") {
    if (!confirm(`Leave room ${session.roomCode}?`)) return;
    api("leave", roomBody()).catch(() => {});
    session = {};
    saveSession();
  } else if (state.players.length && !confirm("Exit this game?")) {
    return;
  }
  state = createLocalRoom();
  setMode(null);
}

function startLocal() {
  state = createLocalRoom();
  setMode("local");
}

async function refreshRoom() {
  if (!session.roomCode || isFileMode) return;
  const payload = await api("state", roomBody());
  state = payload.room;
  render();
}

async function runRemoteAction(action, body = {}) {
  const payload = await api(action, roomBody(body));
  state = payload.room;
  render();
}

function roomBody(extra = {}) {
  return { roomCode: session.roomCode, hostToken: session.hostToken, playerToken: session.playerToken, ...extra };
}

async function api(action, body) {
  const result = await fetch(`${apiBase}?action=${encodeURIComponent(action)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await result.json();
  if (!result.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

async function shareRoom() {
  const url = inviteUrl();
  if (navigator.share) {
    try {
      await navigator.share({ title: "Snooker Shuffle", text: `Join my Snooker Shuffle room ${state.roomCode}`, url });
    } catch {}
    return;
  }
  await navigator.clipboard.writeText(url);
  dom.shareRoom.textContent = "Link copied";
  setTimeout(() => {
    dom.shareRoom.textContent = "Share invite link";
  }, 2000);
}

function startPolling() {
  stopPolling();
  pollTimer = window.setInterval(() => refreshRoom().catch(() => {}), 3000);
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
  const drawnPocket = pickPocket(drawnColor, state.players);
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
  dom.targetPocketText.textContent = `Pot it in the ${pocketName(player.targetPocket)}.`;
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
    await runRemoteAction("drawTarget");
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
  if (!confirm(`Confirm ${player.name} potted the ${player.targetColor.name} in the ${pocketName(player.targetPocket)}?`)) return;
  if (mode === "room") {
    await runRemoteAction("claimWin", { colorName: player.targetColor.name, pocketId: player.targetPocket.id });
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
  if (mode === "room") {
    if (!confirm("Reset the game for everyone in the room?")) return;
    hidePrivateTarget();
    runRemoteAction("reset").catch(showError);
    return;
  }
  state = createLocalRoom();
  hidePrivateTarget();
  render();
}

function clearLink() {
  linkCode = "";
  if (location.search) history.replaceState(null, "", location.pathname);
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

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase().slice(0, 6);
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

function pocketName(pocket) {
  const label = pocket.label.toLowerCase();
  return pocket.group === "corner" ? `${label} corner pocket` : `${label} pocket`;
}

function pocketsForColor(color) {
  const group = color.name === "Blue" ? "middle" : "corner";
  return pockets.filter((pocket) => pocket.group === group);
}

// Only 4 corners exist for 5 non-blue colours, so share the least-used pocket once corners run out.
function pickPocket(color, players) {
  const taken = players.filter((player) => player.targetPocket && player.status !== "out").map((player) => player.targetPocket.id);
  const uses = (pocket) => taken.filter((id) => id === pocket.id).length;
  const options = pocketsForColor(color);
  const fewest = Math.min(...options.map(uses));
  return shuffle(options.filter((pocket) => uses(pocket) === fewest))[0];
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

dom.createRoom.addEventListener("click", () => createRoom().catch(showError));
dom.joinRoom.addEventListener("click", () => joinRoom().catch(showError));
dom.roomCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinRoom().catch(showError);
});
dom.playLocal.addEventListener("click", startLocal);
dom.exitGame.addEventListener("click", leaveGame);
dom.shareRoom.addEventListener("click", () => shareRoom().catch(showError));
dom.youCard.addEventListener("click", (event) => {
  const action = event.target.dataset.you;
  if (action === "draw") openPrivateDraw(session.playerId).catch(showError);
  if (action === "show") showTarget(session.playerId);
});
dom.playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = dom.playerName.value.trim();
  if (!name) return;
  addLocalPlayer(name);
  dom.playerName.value = "";
  render();
});
dom.samplePlayers.addEventListener("click", () => {
  state = createLocalRoom();
  sampleNames.forEach(addLocalPlayer);
  render();
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
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && mode === "room") refreshRoom().catch(() => {});
});

if (session.roomCode && !isFileMode && (!linkCode || linkCode === session.roomCode)) {
  state = { ...createLocalRoom(), roomCode: session.roomCode, isHost: Boolean(session.hostToken), log: ["Reconnecting..."] };
  clearLink();
  setMode("room");
  refreshRoom().catch(showError);
} else {
  if (linkCode) dom.roomCodeInput.value = linkCode;
  render();
}
