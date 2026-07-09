// ---------- State ----------
let data = null;        // last-saved data (mirrors data.json)
let draft = null;       // working copy while in edit mode
let sha = null;         // current GitHub file sha, needed to commit
let editMode = false;
let dirty = false;

const TOKEN_KEY = "foosballAdminToken";

// ---------- Boot ----------
document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadData();
  wireNav();
  wireAdmin();
  renderAll();

  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken) {
    const ok = await tryToken(savedToken);
    if (ok) enterEditMode();
  }
}

async function loadData() {
  const res = await fetch("./data.json?ts=" + Date.now());
  data = await res.json();
  draft = structuredClone(data);
}

// ---------- Nav ----------
function wireNav() {
  document.querySelectorAll(".topbar nav button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".topbar nav button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      document.getElementById("view-" + btn.dataset.view).classList.add("active");
    });
  });
}

// ---------- Player helpers ----------
function playerName(id) {
  const p = draft.players.find(p => p.id === id);
  return p ? p.name : id;
}

// ---------- Standings ----------
function computeStandings() {
  const stats = {};
  draft.players.forEach(p => {
    stats[p.id] = { id: p.id, name: p.name, played: 0, wins: 0, losses: 0, gf: 0, ga: 0, pts: 0 };
  });

  draft.roundRobin.forEach(m => {
    if (m.score1 == null || m.score2 == null) return;
    const s1 = stats[m.p1], s2 = stats[m.p2];
    s1.played++; s2.played++;
    s1.gf += m.score1; s1.ga += m.score2;
    s2.gf += m.score2; s2.ga += m.score1;
    if (m.score1 > m.score2) { s1.wins++; s1.pts += 3; s2.losses++; }
    else if (m.score2 > m.score1) { s2.wins++; s2.pts += 3; s1.losses++; }
    else { s1.pts += 1; s2.pts += 1; }
  });

  const list = Object.values(stats);
  list.forEach(s => s.gd = s.gf - s.ga);
  list.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
  return list;
}

function roundRobinComplete() {
  return draft.roundRobin.every(m => m.score1 != null && m.score2 != null);
}

function getSeeds() {
  // returns array of player ids, index 0 = seed 1, only meaningful once round robin is complete
  return computeStandings().map(s => s.id);
}

// ---------- Render: Standings ----------
function renderStandings() {
  const standings = computeStandings();
  const complete = roundRobinComplete();
  const body = document.getElementById("standingsBody");
  body.innerHTML = "";
  standings.forEach((s, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="num">${complete ? `<span class="seed-badge">${i + 1}</span>` : "&mdash;"}</td>
      <td class="pname">${s.name}</td>
      <td class="num">${s.played}</td>
      <td class="num">${s.wins}</td>
      <td class="num">${s.losses}</td>
      <td class="num">${s.gf}</td>
      <td class="num">${s.ga}</td>
      <td class="num">${s.gd > 0 ? "+" + s.gd : s.gd}</td>
      <td class="num">${s.pts}</td>`;
    body.appendChild(tr);
  });
}

// ---------- Render: Fixtures ----------
function renderFixtures() {
  const grid = document.getElementById("fixturesGrid");
  grid.innerHTML = "";
  draft.roundRobin.forEach(m => {
    const played = m.score1 != null && m.score2 != null;
    const p1win = played && m.score1 > m.score2;
    const p2win = played && m.score2 > m.score1;

    const card = document.createElement("div");
    card.className = "fixture-card";
    card.innerHTML = `
      <span class="match-num">Match ${m.id}</span>
      <div class="fixture-row ${p1win ? "winner" : ""}">
        <span class="pname">${playerName(m.p1)}</span>
        ${scoreEl(m, "score1")}
      </div>
      <div class="fixture-row ${p2win ? "winner" : ""}">
        <span class="pname">${playerName(m.p2)}</span>
        ${scoreEl(m, "score2")}
      </div>
      <span class="fixture-status">${played ? "Final" : "Not played"}</span>
    `;
    grid.appendChild(card);
  });

  if (editMode) attachScoreListeners(grid, draft.roundRobin, false);
}

function scoreEl(m, key) {
  const val = m[key];
  if (editMode) {
    return `<span class="fixture-score editable"><input type="number" min="0" data-match="${m.id}" data-key="${key}" value="${val ?? ""}" placeholder="-"></span>`;
  }
  return `<span class="fixture-score">${val ?? "-"}</span>`;
}

// ---------- Render: Bracket ----------
function renderBracket() {
  const complete = roundRobinComplete();
  const seeds = complete ? getSeeds() : [null, null, null, null, null];
  const nameOf = (idx) => (complete ? playerName(seeds[idx]) : `Seed ${idx + 1}`);

  const playIn = draft.knockout.playIn;
  const playInPlayed = playIn.score1 != null && playIn.score2 != null;
  const playInWinnerIdx = playInPlayed ? (playIn.score1 > playIn.score2 ? 3 : 4) : null; // index into seeds array (seed4=idx3, seed5=idx4)
  const playInWinnerName = playInWinnerIdx != null ? nameOf(playInWinnerIdx) : "Winner: Play-In";

  const semiB = draft.knockout.semiB;
  const semiBPlayed = semiB.score1 != null && semiB.score2 != null;
  const semiBWinnerName = semiBPlayed
    ? (semiB.score1 > semiB.score2 ? nameOf(1) : nameOf(2))
    : "Winner: 2 v 3";

  const semiA = draft.knockout.semiA;
  const semiAPlayed = semiA.score1 != null && semiA.score2 != null;
  const semiAWinnerName = semiAPlayed
    ? (semiA.score1 > semiA.score2 ? nameOf(0) : playInWinnerName)
    : "Winner: 1 v P-I";

  const final = draft.knockout.final;
  const finalPlayed = final.score1 != null && final.score2 != null;

  const canEditPlayIn = complete;
  const canEditSemiB = complete;
  const canEditSemiA = complete && playInPlayed;
  const canEditFinal = complete && semiAPlayed && semiBPlayed;

  const grid = document.getElementById("bracketGrid");
  grid.innerHTML = `
    <div class="bracket-col">
      <div class="bracket-col-label">Play-In</div>
      ${bmatchHtml("playIn", nameOf(3), nameOf(4), playIn, canEditPlayIn, playInPlayed)}
    </div>
    <div class="bracket-col">
      <div class="bracket-col-label">Semifinals</div>
      ${bmatchHtml("semiA", nameOf(0), playInWinnerName, semiA, canEditSemiA, semiAPlayed, playInWinnerIdx == null)}
      ${bmatchHtml("semiB", nameOf(1), nameOf(2), semiB, canEditSemiB, semiBPlayed)}
    </div>
    <div class="bracket-col">
      <div class="bracket-col-label">Final</div>
      ${bmatchHtml("final", semiAPlayed ? semiAWinnerName : "Winner: Semi A", semiBPlayed ? semiBWinnerName : "Winner: Semi B", final, canEditFinal, finalPlayed, !semiAPlayed, !semiBPlayed)}
    </div>
    <div class="bracket-col">
      <div class="bracket-col-label">Champion</div>
      <div class="champion-card">
        <div class="label">Foosball World Cup</div>
        <div class="cname">${finalPlayed ? (final.score1 > final.score2 ? (semiAWinnerName) : (semiBWinnerName)) : "TBD"}</div>
      </div>
    </div>
  `;

  if (editMode) {
    ["playIn", "semiA", "semiB", "final"].forEach(key => {
      grid.querySelectorAll(`input[data-bmatch="${key}"]`).forEach(input => {
        input.addEventListener("input", (e) => {
          const k = e.target.dataset.key;
          const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
          draft.knockout[key][k] = v;
          markDirty();
          renderBracket();
        });
      });
    });
  }
}

function bmatchHtml(key, name1, name2, m, canEdit, played, p1Unknown, p2Unknown) {
  const p1win = played && m.score1 > m.score2;
  const p2win = played && m.score2 > m.score1;
  const row = (name, scoreKey, isWinner, unknown) => {
    const nameHtml = unknown ? `<span class="placeholder">${name}</span>` : `<span class="pname">${name}</span>`;
    let scoreHtml;
    if (canEdit && editMode) {
      scoreHtml = `<span class="score editable"><input type="number" min="0" data-bmatch="${key}" data-key="${scoreKey}" value="${m[scoreKey] ?? ""}" placeholder="-"></span>`;
    } else {
      scoreHtml = `<span class="score">${m[scoreKey] ?? "-"}</span>`;
    }
    return `<div class="brow ${isWinner ? "winner" : ""}">${nameHtml}${scoreHtml}</div>`;
  };
  return `<div class="bmatch">
    ${row(name1, "score1", p1win, p1Unknown)}
    ${row(name2, "score2", p2win, p2Unknown)}
  </div>`;
}

function renderAll() {
  renderStandings();
  renderFixtures();
  renderBracket();
  renderHeroLabels();
}

function renderHeroLabels() {
  draft.players.forEach((p, i) => {
    const el = document.querySelector(`#rod-${i + 1} .rod-label`);
    if (el) el.textContent = p.name.toUpperCase();
  });
}

// ---------- Edit mode: round robin score listeners ----------
function attachScoreListeners(container) {
  container.querySelectorAll("input[data-match]").forEach(input => {
    input.addEventListener("input", (e) => {
      const matchId = parseInt(e.target.dataset.match, 10);
      const key = e.target.dataset.key;
      const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
      const match = draft.roundRobin.find(m => m.id === matchId);
      match[key] = v;
      markDirty();
      renderStandings();
      renderBracket();
    });
  });
}

function markDirty() {
  dirty = true;
  document.getElementById("saveBar").classList.add("show");
}

// ---------- Admin ----------
function wireAdmin() {
  const toggle = document.getElementById("adminToggle");
  const modal = document.getElementById("loginModal");
  const cancel = document.getElementById("loginCancel");
  const confirm = document.getElementById("loginConfirm");
  const tokenInput = document.getElementById("tokenInput");
  const errorMsg = document.getElementById("loginError");

  toggle.addEventListener("click", () => {
    if (editMode) {
      exitEditMode();
    } else {
      modal.classList.add("show");
      tokenInput.value = "";
      errorMsg.classList.remove("show");
      tokenInput.focus();
    }
  });

  cancel.addEventListener("click", () => modal.classList.remove("show"));

  confirm.addEventListener("click", async () => {
    const token = tokenInput.value.trim();
    if (!token) return;
    confirm.textContent = "Checking...";
    confirm.disabled = true;
    const ok = await tryToken(token);
    confirm.textContent = "Log in";
    confirm.disabled = false;
    if (ok) {
      localStorage.setItem(TOKEN_KEY, token);
      modal.classList.remove("show");
      enterEditMode();
      showToast("Logged in as admin");
    } else {
      errorMsg.classList.add("show");
    }
  });

  document.getElementById("discardBtn").addEventListener("click", () => {
    draft = structuredClone(data);
    dirty = false;
    document.getElementById("saveBar").classList.remove("show");
    renderAll();
  });

  document.getElementById("saveBtn").addEventListener("click", saveToGitHub);
}

async function tryToken(token) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataPath}?ref=${GITHUB_CONFIG.branch}`,
      { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) return false;
    const json = await res.json();
    sha = json.sha;
    return true;
  } catch {
    return false;
  }
}

function enterEditMode() {
  editMode = true;
  const toggle = document.getElementById("adminToggle");
  toggle.textContent = "Log Out";
  toggle.classList.add("logged-in");
  renderAll();
}

function exitEditMode() {
  editMode = false;
  dirty = false;
  localStorage.removeItem(TOKEN_KEY);
  document.getElementById("saveBar").classList.remove("show");
  draft = structuredClone(data);
  const toggle = document.getElementById("adminToggle");
  toggle.textContent = "Admin Login";
  toggle.classList.remove("logged-in");
  renderAll();
}

async function saveToGitHub() {
  const token = localStorage.getItem(TOKEN_KEY);
  const saveBtn = document.getElementById("saveBtn");
  saveBtn.textContent = "Saving...";
  saveBtn.disabled = true;
  try {
    const content = b64EncodeUnicode(JSON.stringify(draft, null, 2));
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataPath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Update tournament data — ${new Date().toISOString()}`,
          content,
          sha,
          branch: GITHUB_CONFIG.branch
        })
      }
    );
    if (!res.ok) throw new Error("save failed");
    const json = await res.json();
    sha = json.content.sha;
    data = structuredClone(draft);
    dirty = false;
    document.getElementById("saveBar").classList.remove("show");
    showToast("Saved! GitHub Pages will update in ~30-60s.");
  } catch (e) {
    showToast("Save failed — check your token still has write access.", true);
  } finally {
    saveBtn.textContent = "Save to GitHub";
    saveBtn.disabled = false;
  }
}

function b64EncodeUnicode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode("0x" + p1)));
}

function showToast(msg, isError) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast show" + (isError ? " error" : "");
  setTimeout(() => toast.classList.remove("show"), 3500);
}
