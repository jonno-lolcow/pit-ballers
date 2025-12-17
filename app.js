// ==========================
// Pit Ballers — Full JS (fixed + updated)
// ==========================

const TEAM_SKILL = {
  "Lolcow Balls": 61,
  "Lolcow Pit": 55,
  "Lolcow Queens (a)": 58,
  "Lolcow Queens (b)": 52,
  "Lolcow Live (a)": 57,
  "Lolcow Live (b)": 61,
  "Lolcow Rebel": 36,
  "Lolcow Nerd": 49,
  "Lolcow Babe": 27,
  "Lolcow Reapers": 55,
  "Lolcow Fire": 25,
  "Lolcow Rain": 31,
  "Lolcow Crypt": 45,
  "Lolcow Chubby": 49,
  "Lolcow Aussy": 43,
  "Lolcow Test": 43,
  "Lolcow Rewind": 57,
  "Lolcow Cafe": 51,
  "Lolcow Nuts": 52,
  "Lolcow Cash (a)": 42,
  "Lolcow Cash (b)": 53,
  "Lolcow Wild (a)": 20,
  "Lolcow Wild (b)": 30,
  "Lolcow Boss": 65,
  "Lolcow Alpha": 36,
};

const TEAM_NAMES = [
  "Lolcow Balls",
  "Lolcow Pit",
  "Lolcow Queens (a)",
  "Lolcow Queens (b)",
  "Lolcow Live (a)",
  "Lolcow Live (b)",
  "Lolcow Rebel",
  "Lolcow Nerd",
  "Lolcow Babe",
  "Lolcow Reapers",
  "Lolcow Fire",
  "Lolcow Rain",
  "Lolcow Crypt",
  "Lolcow Chubby",
  "Lolcow Aussy",
  "Lolcow Test",
  "Lolcow Rewind",
  "Lolcow Cafe",
  "Lolcow Nuts",
  "Lolcow Cash (a)",
  "Lolcow Cash (b)",
  "Lolcow Wild (a)",
  "Lolcow Wild (b)",
  "Lolcow Boss",
  "Lolcow Alpha",
];

const UPSET_CHANCE = 0.085;      // 5%
const UPSET_GAP_MIN = 10;       // only if skill diff > 10

async function hydrateSponsorsFromFirestore() {
  try {
    const snap = await window.db.collection("teams").get();
    const byId = new Map();
    snap.forEach(doc => byId.set(doc.id, doc.data()));

    for (const t of TEAMS) {
      const row = byId.get(t.id);
      if (row?.sponsorName) t.sponsor = row.sponsorName;
      // optional (only keep if you actually want DB to override names)
      // if (row?.name) t.name = row.name;
    }
  } catch (e) {
    console.warn("Sponsor load failed (using defaults):", e);
  }
}

function buildWinnerRoute(tour) {
  if (!tour?.winner) return [];
  const champId = tour.winner.id;

  const won = (tour.history || [])
    .filter(m => m?.result?.winner?.id === champId)
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0));

  return won.map(m => {
    const winnerIsA = m.a?.id === champId;
    const opp = winnerIsA ? m.b : m.a;

    const scoreW = winnerIsA ? m.result.scoreA : m.result.scoreB;
    const scoreO = winnerIsA ? m.result.scoreB : m.result.scoreA;

    return {
      round: m.round,
      label: roundLabel(m.round),
      opponent: opp?.name ?? "—",
      score: `${scoreW}–${scoreO}`,
      isAuto: !!m.result.isAuto,
      isBye: !!opp?.isBye,
    };
  });
}

function resetTournamentState() {
  currentTour = null;

  $("bracket") && ($("bracket").textContent = "");
  $("nextMatch") && ($("nextMatch").textContent = "");
  $("playNext") && ($("playNext").disabled = true);

  ensureTournamentButtons();
  updateProgressUI(null);
}


function shouldTriggerUpset(teamA, teamB) {
  const gap = Math.abs(overallScore(teamA) - overallScore(teamB));
  if (gap <= UPSET_GAP_MIN) return false;
  return Math.random() < UPSET_CHANCE;
}

function keyFromName(name) {
  return name.replaceAll(" ", "_");
}

const TEAMS = TEAM_NAMES.map((name, idx) => ({
  id: `t${String(idx + 1).padStart(2, "0")}`,
  name,
  skill: TEAM_SKILL[name] ?? 50,
  sponsor: "Your Name Here",
  cardImg: `img/teams/${keyFromName(name)}.png`,
  iconImg: `img/icons/${keyFromName(name)}.png`,
}));

function overallScore(team) {
  return Number.isFinite(team?.skill) ? team.skill : (TEAM_SKILL[team?.name] ?? 50);
}

function teamFooterHtml(team) {
  return `
    <div class="sponsorOnly">
      Sponsored by: ${team.sponsor ?? "Your Name Here"}
    </div>
  `;
}

// --- Utilities ---
function $(id) { return document.getElementById(id); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function setView(name) {
  const views = ["viewHome","viewH2H","viewTour","viewMatch","viewWinners","viewResults"];
  for (const v of views) {
    const el = $(v);
    if (el) el.classList.toggle("hidden", v !== name);
  }
}

function breakTie(scoreA, scoreB) {
  if (scoreA !== scoreB) return { scoreA, scoreB, tieBreak: false, winnerSide: null };

  // Sudden-death: give 1 point to a random side
  if (Math.random() < 0.5) scoreA += 1;
  else scoreB += 1;

  return {
    scoreA,
    scoreB,
    tieBreak: true,
    winnerSide: (scoreA > scoreB ? "A" : "B"),
  };
}


// ==========================
// Image preloading (anti-lag)
// ==========================
const IMG_CACHE = new Map();

function preloadImage(src) {
  if (!src) return Promise.resolve(null);
  if (IMG_CACHE.has(src)) return IMG_CACHE.get(src);

  const p = new Promise((resolve) => {
    const im = new Image();
    im.decoding = "async";
    im.loading = "eager";
    im.src = src;

    const done = async () => {
      try { if (im.decode) await im.decode(); } catch {}
      resolve(im);
    };

    if (im.complete) done();
    else {
      im.onload = done;
      im.onerror = () => resolve(im);
    }
  });

  IMG_CACHE.set(src, p);
  return p;
}

async function preloadAllTeamAssets() {
  const urls = [];
  for (const t of TEAMS) urls.push(t.cardImg, t.iconImg);
  await Promise.all(urls.map(preloadImage));
}

function showWinnersScreen() {
  const tour = currentTour;
  if (!tour?.winner) return;

  $("winnerName") && ($("winnerName").textContent = tour.winner.name);

  if ($("winnerRating")) {
    $("winnerRating").innerHTML = `
      <div class="sponsorOnly large">
        Sponsored by: ${tour.winner.sponsor ?? "Your Name Here"}
      </div>
    `;
  }

  // ✅ Route to final (always runs)
  const routeEl = $("winnerRoute");
  if (routeEl) {
    const route = buildWinnerRoute(tour);

    routeEl.innerHTML = route.length
      ? route.map(r => `
          <div class="routeRow">
            <div class="routeRound">${r.label}</div>
            <div class="routeLine">
              vs <b>${r.opponent}</b>
              <span class="muted">${r.isAuto || r.isBye ? "(BYE)" : r.score}</span>
            </div>
          </div>
        `).join("")
      : `<div class="muted">No route available.</div>`;
  }

  $("winnerImg") && ($("winnerImg").src = tour.winner.cardImg);
  $("winnerSponsor") && ($("winnerSponsor").textContent = `Sponsored by: ${tour.winner.sponsor ?? "Your Name Here"}`);

  // awards...
  // (leave your bigScorer / bigLoser code as-is)

  setView("viewWinners");
  confettiBurst();
  fireworksBurst(4);
}


// ==========================
// Arcade selector
// ==========================
function renderArcadeSelector(containerEl, teams, onPick) {
  if (!containerEl) return;
  containerEl.innerHTML = "";
  teams.forEach((t, i) => {
    const btn = document.createElement("div");
    btn.className = "arcadeIcon";
    btn.dataset.index = String(i);
    btn.dataset.name = t.name;

    const img = document.createElement("img");
    img.src = t.iconImg;
    img.alt = t.name;
    img.onerror = () => { img.remove(); btn.textContent = "PB"; };

    btn.appendChild(img);
    btn.addEventListener("click", () => onPick(i));
    containerEl.appendChild(btn);
  });
}

function setArcadeActive(containerEl, index) {
  if (!containerEl) return;
  containerEl.querySelectorAll(".arcadeIcon").forEach(el => el.classList.remove("active"));
  const active = containerEl.querySelector(`.arcadeIcon[data-index="${index}"]`);
  if (active) active.classList.add("active");
}

// ==========================
// Carousel
// ==========================
function createCarousel(containerEl, teams, initialIndex = 0, variant = "browser", onChange = null) {
  let idx = initialIndex;

  const left = document.createElement("button");
  left.className = "navBtn";
  left.textContent = "←";

  const right = document.createElement("button");
  right.className = "navBtn";
  right.textContent = "→";

  const wrap = document.createElement("div");
  wrap.className = "cardWrap";

  const heading = document.createElement("div");
  heading.className = "cardHeading";

  const img = document.createElement("img");
  img.alt = "team card";

  const footer = document.createElement("div");
  footer.className = "cardFooter";

  wrap.appendChild(heading);
  wrap.appendChild(img);
  wrap.appendChild(footer);

  containerEl.innerHTML = "";
  containerEl.appendChild(left);
  containerEl.appendChild(wrap);
  containerEl.appendChild(right);

  function render() {
    const t = teams[idx];
    heading.textContent = t.name;

    const targetSrc = t.cardImg;
    img.dataset.src = targetSrc;
    img.classList.add("isLoading");

    preloadImage(targetSrc).then(() => {
      if (img.dataset.src !== targetSrc) return; // user moved on
      img.src = targetSrc;
      img.classList.remove("isLoading");
    });

    footer.innerHTML = teamFooterHtml(t);

    if (variant === "browser") {
      const arcadeEl = $("arcadeSelector");
      if (arcadeEl) setArcadeActive(arcadeEl, idx);
    }

    onChange?.(idx, t);
  }

  function prev() { idx = (idx - 1 + teams.length) % teams.length; render(); }
  function next() { idx = (idx + 1) % teams.length; render(); }

  left.addEventListener("click", prev);
  right.addEventListener("click", next);

  function onKey(e) {
    if (containerEl.closest(".hidden")) return;
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  }
  window.addEventListener("keydown", onKey);

  render();

  return {
    getIndex: () => idx,
    getTeam: () => teams[idx],
    setIndex: (n) => {
      idx = ((n % teams.length) + teams.length) % teams.length;
      render();
    },
    destroy: () => window.removeEventListener("keydown", onKey),
  };
}

// ==========================
// Match simulation
// ==========================
function choose2or3() { return Math.random() < 0.7 ? 2 : 3; }
function computeEffective(skill) {
  const performance = randInt(-20, 20);
  const effective = (skill * 0.6) + ((skill + performance) * 0.4);
  return { performance, effective };
}

function buildScoringEvents() {
  const eventCount = randInt(18, 34);
  const times = [];
  for (let i = 0; i < eventCount; i++) times.push(Math.random() * 30000);
  times.sort((a, b) => a - b);
  return times.map((t, i) => ({ t, id: i }));
}

function planMatch(teamA, teamB) {
  const oA = overallScore(teamA);
  const oB = overallScore(teamB);

  const A = computeEffective(oA);
  const B = computeEffective(oB);

  const events = buildScoringEvents();

  // base probability from effective performance
  const denom = (A.effective + B.effective) || 1;
  let pA = A.effective / denom;

  // --- Upset logic ---
  const upset = shouldTriggerUpset(teamA, teamB);

  // identify underdog by base skill
  const underdogSide = (oA < oB) ? "A" : (oB < oA ? "B" : null);

  if (upset && underdogSide) {
    // flip the advantage toward the underdog (strong bias but not 100%)
    // underdog gets ~65% of scoring events
    pA = (underdogSide === "A") ? 0.65 : 0.35;
  }

  const planned = events.map(e => ({
    ...e,
    scorer: (Math.random() < pA ? "A" : "B"),
    points: choose2or3()
  }));

  return { planned, upset, underdogSide };
}


function runMatchRealtime(teamA, teamB, opts) {
  const { onUpdate, onDone } = opts;
  const DURATION = 30000;
  let speed = 1;

  const { planned, upset } = planMatch(teamA, teamB);

  let scoreA = 0, scoreB = 0, i = 0;
  let rafId = null, done = false, skipped = false;
  const start = performance.now();

  function applyEvent(ev) {
    if (ev.scorer === "A") scoreA += ev.points;
    else scoreB += ev.points;
  }
  function applyRemaining() {
    for (; i < planned.length; i++) applyEvent(planned[i]);
  }

  function finish() {
    // ensure no draw
    const tb = breakTie(scoreA, scoreB);
    scoreA = tb.scoreA;
    scoreB = tb.scoreB;

    done = true;
    onDone?.({ scoreA, scoreB, skipped, upset, tieBreak: tb.tieBreak });
  }

  function frame(now) {
    if (done) return;

    const elapsed = (now - start) * speed;

    while (i < planned.length && planned[i].t <= elapsed) {
      const ev = planned[i];
      applyEvent(ev);
      i++;
      onUpdate?.({ elapsedMs: clamp(elapsed, 0, DURATION), scoreA, scoreB, lastEvent: ev });
    }

    if (elapsed >= DURATION) {
      applyRemaining();
      finish();
      return;
    }

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return {
    setSpeed: (s) => { speed = s; },
    skipToEnd: () => {
      if (done) return;
      skipped = true;
      cancelAnimationFrame(rafId);
      applyRemaining();
      finish();
    }
  };
}

// ==========================
// Tournament
// ==========================
function isBye(t) { return !!t?.isBye; }

function generateBracket32(teams) {
  const shuffled = shuffle(teams);
  const byesNeeded = 32 - shuffled.length;
  const byeObj = () => ({ id:`bye_${Math.random().toString(16).slice(2)}`, name:"BYE", isBye:true });

  const byeTeams = shuffled.slice(0, byesNeeded);
  const remaining = shuffled.slice(byesNeeded);

  const round1 = [];
  let mNum = 1;

  for (const t of byeTeams) round1.push({ a:t, b:byeObj(), round:1, matchId:`R1M${mNum++}` });

  for (let i = 0; i < remaining.length; i += 2) {
    round1.push({ a: remaining[i], b: remaining[i+1], round:1, matchId:`R1M${mNum++}` });
  }

  return {
    rounds:[round1],
    currentRound:1,
    currentMatchIndex:0,
    history:[],
    winner:null,
    awards:{ bigScorer:null, biggestLoser:null },
    started:false,
  };
}

function roundLabel(r) {
  return r===1?"Round of 32":
         r===2?"Round of 16":
         r===3?"Quarterfinals":
         r===4?"Semifinals":"Final";
}

function recordBigScorer(tour, teamA, teamB, scoreA, scoreB, round) {
  const diff = Math.abs(scoreA - scoreB);
  const entry = { diff, teamA, teamB, scoreA, scoreB, round };
  if (!tour.awards.bigScorer || diff > tour.awards.bigScorer.diff) tour.awards.bigScorer = entry;
}

function considerBiggestLoser(tour, eliminatedTeam, roundEliminated) {
  if (isBye(eliminatedTeam)) return;
  const cur = tour.awards.biggestLoser;
  const entry = { team: eliminatedTeam, roundEliminated };

  if (!cur) { tour.awards.biggestLoser = entry; return; }
  if (roundEliminated < cur.roundEliminated) { tour.awards.biggestLoser = entry; return; }
  if (roundEliminated === cur.roundEliminated && overallScore(eliminatedTeam) > overallScore(cur.team)) {
    tour.awards.biggestLoser = entry;
  }
}

function resolveMatchResult(tour, match, payload) {
  const { winner, loser, scoreA, scoreB, skipped, isAuto } = payload;
  match.result = { winner, loser, scoreA, scoreB, skipped, isAuto };

  if (!isAuto) recordBigScorer(tour, match.a, match.b, scoreA, scoreB, match.round);
  if (!isAuto) considerBiggestLoser(tour, loser, match.round);

  tour.history.push(match);
}

function buildNextRoundIfNeeded(tour) {
  const roundArr = tour.rounds[tour.currentRound - 1];
  if (!roundArr) return;
  const allResolved = roundArr.every(m => !!m.result);
  if (!allResolved) return;

  const winners = roundArr.map(m => m.result.winner).filter(w => !isBye(w));

  if (winners.length === 1) { tour.winner = winners[0]; return; }

  const next = [];
  for (let i = 0; i < winners.length; i += 2) {
    next.push({ a:winners[i], b:winners[i+1], round: tour.currentRound+1, matchId:`R${tour.currentRound+1}M${i/2+1}` });
  }

  tour.rounds.push(next);
  tour.currentRound++;
  tour.currentMatchIndex = 0;
}

function renderTeamCell(team, side, result) {
  const cell = document.createElement("div");
  cell.className = `teamCell ${side}`;

  if (team && !isBye(team)) {
    const icon = document.createElement("img");
    icon.className = "teamIcon";
    icon.src = team.iconImg;
    icon.alt = `${team.name} icon`;
    icon.onerror = () => icon.remove();
    cell.appendChild(icon);
  }

  const name = document.createElement("div");
  name.className = "teamNameText";

  if (!team) name.textContent = "—";
  else if (isBye(team)) { name.textContent = "BYE"; name.classList.add("bye"); }
  else name.textContent = team.name;

  if (result && team && !isBye(team)) {
    if (result.winner?.id === team.id) name.classList.add("win");
    if (result.loser?.id === team.id) name.classList.add("lose");
  }

  cell.appendChild(name);
  return cell;
}

function renderBracket(tour) {
  const el = $("bracket");
  if (!el) return;
  if (!tour) { el.textContent = "No bracket yet."; return; }
  el.innerHTML = "";

  for (let r = 0; r < tour.rounds.length; r++) {
    const roundNum = r + 1;
    const matches = tour.rounds[r];

    const section = document.createElement("div");
    section.className = "roundSection";
    if (roundNum < tour.currentRound) section.classList.add("collapsed");

    const header = document.createElement("div");
    header.className = "roundHeader";
    header.innerHTML = `<div>${roundLabel(roundNum)}</div><div class="meta">${roundNum < tour.currentRound ? "finished (click to expand)" : "click to collapse"}</div>`;
    header.addEventListener("click", () => section.classList.toggle("collapsed"));

    const body = document.createElement("div");
    body.className = "roundBody";

    for (const m of matches) {
      const line = document.createElement("div");
      line.className = "matchLine";

      line.appendChild(renderTeamCell(m.a, "left", m.result));
      const vs = document.createElement("div");
      vs.className = "vs";
      vs.textContent = "VS";
      line.appendChild(vs);
      line.appendChild(renderTeamCell(m.b, "right", m.result));

      const small = document.createElement("div");
      small.className = "small";

      if (m.result) {
        if (m.result.isAuto) small.textContent = `Auto-advance: ${m.result.winner?.name ?? "—"}`;
        else small.textContent = `${m.result.scoreA} - ${m.result.scoreB} • Winner: ${m.result.winner.name}`;
      } else if (!isBye(m.a) && isBye(m.b)) small.textContent = `Auto-advance: ${m.a.name}`;
      else if (isBye(m.a) && !isBye(m.b)) small.textContent = `Auto-advance: ${m.b.name}`;
      else small.textContent = "Pending";

      line.appendChild(small);
      body.appendChild(line);
    }

    section.appendChild(header);
    section.appendChild(body);
    el.appendChild(section);
  }
}

function setNextMatchText(tour) {
  const el = $("nextMatch");
  if (!el) return;

  if (!tour) { el.textContent = "Generate a bracket to begin."; return; }

  const roundArr = tour.rounds[tour.currentRound - 1];
  if (!roundArr) { el.textContent = "Tournament complete."; return; }

  while (tour.currentMatchIndex < roundArr.length) {
    const m = roundArr[tour.currentMatchIndex];

    if (m.result) { tour.currentMatchIndex++; continue; }

    // auto-advance: real team beats BYE
    if (!isBye(m.a) && isBye(m.b)) {
      resolveMatchResult(tour, m, { winner:m.a, loser:m.b, scoreA:0, scoreB:0, skipped:true, isAuto:true });
      tour.currentMatchIndex++; continue;
    }
    if (isBye(m.a) && !isBye(m.b)) {
      resolveMatchResult(tour, m, { winner:m.b, loser:m.a, scoreA:0, scoreB:0, skipped:true, isAuto:true });
      tour.currentMatchIndex++; continue;
    }

    el.textContent = `Next: ${roundLabel(m.round)} — ${m.a.name} vs ${m.b.name}`;
    return;
  }

  buildNextRoundIfNeeded(tour);
  renderBracket(tour);
  setNextMatchText(tour);
}

function totalRoundsExpected() { return 5; }
function roundsCompleted(tour) {
  if (!tour) return 0;
  if (tour.winner) return totalRoundsExpected();
  return Math.max(0, tour.currentRound - 1);
}
function updateProgressUI(tour) {
  const fill = $("progressFill");
  const txt = $("progressText");
  const pill = $("tourStagePill");
  if (!fill || !txt || !pill) return;

  if (!tour) {
    fill.style.width = "0%";
    txt.textContent = "0%";
    pill.textContent = "Not started";
    return;
  }

  const done = roundsCompleted(tour);
  const pct = Math.round((done / totalRoundsExpected()) * 100);

  fill.style.width = `${pct}%`;
  txt.textContent = `${pct}%`;

  if (tour.winner) pill.textContent = "Final complete";
  else if (tour.started) pill.textContent = `In progress — ${roundLabel(tour.currentRound)}`;
  else pill.textContent = "Bracket ready";
}

function ensureTournamentButtons() {
  const gen = $("genTour");
  const playNext = $("playNext");
  const nextWrap = $("nextMatchWrap");

  if (!gen || !playNext || !nextWrap) return;

  const hasBracket = !!currentTour;

  // Generate button only before bracket exists
  gen.classList.toggle("hidden", hasBracket);

  // Next Match panel + Play button only after bracket exists
  nextWrap.classList.toggle("hidden", !hasBracket);

  updateProgressUI(currentTour);

  // Play enabled when tournament exists (we auto-start on generate)
  playNext.disabled = !hasBracket;
}

// ==========================
// UI State + Wiring
// ==========================
let browser;
let pickerA, pickerB;

let chosenTeamA = null;
let chosenTeamB = null;

let currentMode = null; // "H2H" | "TOUR"
let currentTour = null;

let matchController = null;
let pendingContinue = null;

function syncH2HSelection() {
  if (!pickerA || !pickerB) return;
  chosenTeamA = pickerA.getTeam();
  chosenTeamB = pickerB.getTeam();
}

async function init() {
  // warm cache ASAP (no await, just start it)
  preloadAllTeamAssets();

  await hydrateSponsorsFromFirestore(); // <-- add this line 
  
  // HOME
  browser = createCarousel($("browserCarousel"), TEAMS, 0, "browser");
  renderArcadeSelector($("arcadeSelector"), TEAMS, (idx) => {
    browser.setIndex(idx);
    setArcadeActive($("arcadeSelector"), idx);
  });
  setArcadeActive($("arcadeSelector"), browser.getIndex());

  // H2H (auto-selection, no “Set Team” buttons needed)
  pickerA = createCarousel($("pickA"), TEAMS, 0, "picker", () => syncH2HSelection());
  pickerB = createCarousel($("pickB"), TEAMS, 1, "picker", () => syncH2HSelection());
  syncH2HSelection();

  // Nav
  $("btnHome")?.addEventListener("click", () => goHome());

  $("goH2H")?.addEventListener("click", () => {
    currentMode = "H2H";
    setView("viewH2H");
    // ensure we always have a valid selection
    syncH2HSelection();
  });

  $("goTour")?.addEventListener("click", () => {
    currentMode = "TOUR";
    setView("viewTour");
    ensureTournamentButtons();
    setNextMatchText(currentTour);
    renderBracket(currentTour);
  });

  // H2H randomize (sets pickers; selection auto-syncs)
  $("randH2H")?.addEventListener("click", () => {
    const i = randInt(0, TEAMS.length - 1);
    let j = randInt(0, TEAMS.length - 1);
    while (j === i) j = randInt(0, TEAMS.length - 1);

    pickerA.setIndex(i);
    pickerB.setIndex(j);
    syncH2HSelection();
  });

  $("startH2H")?.addEventListener("click", () => {
    syncH2HSelection();
    if (!chosenTeamA || !chosenTeamB || chosenTeamA.id === chosenTeamB.id) return;

    startMatch(chosenTeamA, chosenTeamB, {
      title: "Head-to-Head",
      onComplete: () => setView("viewH2H"),
      continueLabel: "Back",
      hideBackOnDone: false,
    });
  });

  // Tournament controls
$("genTour")?.addEventListener("click", () => {
  currentTour = generateBracket32(TEAMS);
  currentTour.started = true;              // <-- auto-start
  renderBracket(currentTour);
  setNextMatchText(currentTour);
  ensureTournamentButtons();
  $("playNext") && ($("playNext").disabled = false);
});

  $("playNext")?.addEventListener("click", () => playNextTournamentMatch());

  $("resetTour")?.addEventListener("click", () => {
    currentTour = null;
    if ($("bracket")) $("bracket").textContent = "";
    if ($("nextMatch")) $("nextMatch").textContent = "Generate a bracket to begin.";
    ensureTournamentButtons();
    setView("viewTour");
  });

  // Match controls
  $("speed1")?.addEventListener("click", () => setSpeedUI(1));
  $("speed2")?.addEventListener("click", () => setSpeedUI(2));
  $("speed4")?.addEventListener("click", () => setSpeedUI(4));
  $("skip")?.addEventListener("click", () => matchController?.skipToEnd());

  $("backAfterMatch")?.addEventListener("click", () => {
    if (currentMode === "H2H") setView("viewH2H");
    else setView("viewTour");
  });
  $("continueAfterMatch")?.addEventListener("click", () => pendingContinue?.());

  function buildWinnerRoute(tour) {
  if (!tour?.winner) return [];

  // matches the champion won (exclude BYE auto-advances if you want)
  const won = tour.history
    .filter(m => m?.result?.winner?.id === tour.winner.id)
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0));

  return won.map(m => {
    const opp = (m.a.id === tour.winner.id) ? m.b : m.a;
    const scoreW = (m.a.id === tour.winner.id) ? m.result.scoreA : m.result.scoreB;
    const scoreO = (m.a.id === tour.winner.id) ? m.result.scoreB : m.result.scoreA;

    return {
      round: m.round,
      label: roundLabel(m.round),
      opponent: opp?.name ?? "—",
      score: `${scoreW}–${scoreO}`,
      isAuto: !!m.result.isAuto,
    };
  });
}
    
  $("winnersHome")?.addEventListener("click", () => {
    resetTournamentState();
    goHome();
  });
  
  $("winnersRestart")?.addEventListener("click", () => {
    resetTournamentState();
    currentMode = "TOUR";
    setView("viewTour");
  });

  // Trophy fallback (if trophy png missing)
  ensureTrophyFallback();

  goHome();
}

function goHome() {
  currentMode = null;
  setView("viewHome");
}

function setSpeedUI(speed) {
  for (const [id, s] of [["speed1", 1], ["speed2", 2], ["speed4", 4]]) {
    const el = $(id);
    if (el) el.classList.toggle("active", s === speed);
  }
  matchController?.setSpeed(speed);
}

// Flash the whole team tile (CSS should animate .team.flash)
function flashScorer(which) {
  const scoreEl = which === "A" ? $("mScoreA") : $("mScoreB");
  if (!scoreEl) return;

  const tile = scoreEl.closest(".team");
  if (!tile) return;

  tile.classList.remove("flash");
  void tile.offsetWidth;
  tile.classList.add("flash");
}

function resetMatchWinLoseStyling() {
  $("matchCardA")?.classList.remove("winGlow","loseGray");
  $("matchCardB")?.classList.remove("winGlow","loseGray");
}
function applyWinLoseStyling(teamA, teamB, scoreA, scoreB) {
  resetMatchWinLoseStyling();

  let winnerSide = null;
  if (scoreA === scoreB) winnerSide = (Math.random() < 0.5 ? "A" : "B");
  else winnerSide = (scoreA > scoreB ? "A" : "B");

  if (winnerSide === "A") {
    $("matchCardA")?.classList.add("winGlow");
    $("matchCardB")?.classList.add("loseGray");
  } else {
    $("matchCardB")?.classList.add("winGlow");
    $("matchCardA")?.classList.add("loseGray");
  }

  return winnerSide;
}

function hydrateMatchCards(teamA, teamB) {
  if ($("mcNameA")) $("mcNameA").textContent = teamA.name;
  if ($("mcNameB")) $("mcNameB").textContent = teamB.name;

  preloadImage(teamA.cardImg).then(() => { if ($("mcImgA")) $("mcImgA").src = teamA.cardImg; });
  preloadImage(teamB.cardImg).then(() => { if ($("mcImgB")) $("mcImgB").src = teamB.cardImg; });

  if ($("mcFooterA")) $("mcFooterA").innerHTML = teamFooterHtml(teamA);
  if ($("mcFooterB")) $("mcFooterB").innerHTML = teamFooterHtml(teamB);

  resetMatchWinLoseStyling();
}

function startMatch(teamA, teamB, opts) {
  setView("viewMatch");

  if ($("matchTitle")) $("matchTitle").textContent = opts.title ?? "Match";

  if ($("mScoreA")) $("mScoreA").textContent = "0";
  if ($("mScoreB")) $("mScoreB").textContent = "0";
  if ($("lastEvent")) $("lastEvent").textContent = "—";
  if ($("mClock")) $("mClock").textContent = "30.0s";

  hydrateMatchCards(teamA, teamB);

  $("backAfterMatch")?.classList.add("hidden");
  $("continueAfterMatch")?.classList.add("hidden");

  setSpeedUI(1);
  matchController = null;
  pendingContinue = null;

matchController = runMatchRealtime(teamA, teamB, {
  onUpdate: ({ elapsedMs, scoreA, scoreB, lastEvent }) => {
    const remaining = Math.max(0, 30000 - elapsedMs);
    if ($("mClock")) $("mClock").textContent = `${(remaining / 1000).toFixed(1)}s`;
    if ($("mScoreA")) $("mScoreA").textContent = String(scoreA);
    if ($("mScoreB")) $("mScoreB").textContent = String(scoreB);

    if (lastEvent && $("lastEvent")) {
      const who = lastEvent.scorer === "A" ? teamA.name : teamB.name;
      $("lastEvent").textContent = `${who} +${lastEvent.points}`;
      flashScorer(lastEvent.scorer);
    }
  },

  onDone: (res) => {
    if ($("mScoreA")) $("mScoreA").textContent = String(res.scoreA);
    if ($("mScoreB")) $("mScoreB").textContent = String(res.scoreB);
    if ($("mClock"))  $("mClock").textContent  = "0.0s";

    if ($("lastEvent")) {
      if (res.upset) {
        $("lastEvent").textContent = res.skipped
          ? "😱 Wow — What an upset!!! (Skipped)"
          : "😱 Wow — What an upset!!!";
      } else {
        $("lastEvent").textContent = res.skipped ? "Skipped to end." : "Final.";
      }
     if (res.tieBreak && $("lastEvent")) {
      $("lastEvent").textContent = "🔥 Overtime! Sudden-death winner!";
      }
    }

    applyWinLoseStyling(teamA, teamB, res.scoreA, res.scoreB);

    const isFinalUI = opts.hideBackOnDone === true;
    const isH2H = (currentMode === "H2H") || (opts.title === "Head-to-Head");

    $("backAfterMatch")?.classList.add("hidden");
    $("continueAfterMatch")?.classList.add("hidden");
    pendingContinue = null;

    if (isH2H) {
      $("backAfterMatch")?.classList.remove("hidden");
      return;
    }

    $("continueAfterMatch")?.classList.remove("hidden");
    if ($("continueAfterMatch")) {
      $("continueAfterMatch").textContent = isFinalUI
        ? "Next"
        : (opts.continueLabel ?? "Continue Tournament");
    }
    $("backAfterMatch")?.classList.toggle("hidden", isFinalUI);

    pendingContinue = () => opts.onComplete?.(res);
  }
});

}

function playNextTournamentMatch() {
  if (!currentTour || !currentTour.started || currentTour.winner) return;

  setNextMatchText(currentTour);
  renderBracket(currentTour);
  updateProgressUI(currentTour);

  const roundArr = currentTour.rounds[currentTour.currentRound - 1];
  if (!roundArr) return;

  // Find the next real (non-bye) unresolved match
  let m = null;
  while (currentTour.currentMatchIndex < roundArr.length) {
    const candidate = roundArr[currentTour.currentMatchIndex];
    if (!candidate.result && !isBye(candidate.a) && !isBye(candidate.b)) { m = candidate; break; }
    currentTour.currentMatchIndex++;
  }

  // If no playable match, advance rounds and return to bracket
  if (!m) {
    buildNextRoundIfNeeded(currentTour);
    setNextMatchText(currentTour);
    renderBracket(currentTour);
    updateProgressUI(currentTour);
    return;
  }

  const isFinalMatch = (roundLabel(m.round) === "Final");

  startMatch(m.a, m.b, {
    title: `Tournament — ${roundLabel(m.round)}`,
    continueLabel: isFinalMatch ? "Next" : "Continue Tournament",
    hideBackOnDone: isFinalMatch,
    onComplete: (res) => {
      let winner, loser;

       if (res.scoreA > res.scoreB) {
        winner = m.a; loser = m.b;
      } else {
        winner = m.b; loser = m.a;
      }

      resolveMatchResult(currentTour, m, {
        winner,
        loser,
        scoreA: res.scoreA,
        scoreB: res.scoreB,
        skipped: res.skipped,
        isAuto: false,
      });

      currentTour.currentMatchIndex++;
      buildNextRoundIfNeeded(currentTour);

      if (isFinalMatch) {
        showWinnersScreen();
        return;
      }

      renderBracket(currentTour);
      setNextMatchText(currentTour);
      updateProgressUI(currentTour);
      ensureTournamentButtons();
      setView("viewTour");
    }
  });
}

// ==========================
// Winners FX
// ==========================
function confettiBurst() {
  const box = $("confetti");
  if (!box) return;

  box.innerHTML = "";
  const pieces = 70;
  const colors = ["#4ea1ff","#58ff9b","#ff4e6a","#ffd24e","#b57bff","#ffffff"];

  for (let i = 0; i < pieces; i++) {
    const d = document.createElement("div");
    d.className = "c";

    const left = Math.random() * 100;
    const delay = Math.random() * 0.25;
    const dur = 1.2 + Math.random() * 1.2;
    const sizeW = 8 + Math.random() * 6;
    const sizeH = 10 + Math.random() * 10;

    d.style.left = `${left}%`;
    d.style.animationDelay = `${delay}s`;
    d.style.animationDuration = `${dur}s`;
    d.style.width = `${sizeW}px`;
    d.style.height = `${sizeH}px`;
    d.style.background = colors[Math.floor(Math.random() * colors.length)];

    box.appendChild(d);
  }

  setTimeout(() => { box.innerHTML = ""; }, 2600);
}

function fireworksBurst(bursts = 3) {
  const box = $("fireworks");
  if (!box) return;

  box.innerHTML = "";
  const colors = ["#4ea1ff","#58ff9b","#ff4e6a","#ffd24e","#b57bff","#ffffff"];

  for (let b = 0; b < bursts; b++) {
    const cx = 20 + Math.random() * 60;
    const cy = 15 + Math.random() * 35;
    const sparks = 26 + Math.floor(Math.random() * 18);

    for (let i = 0; i < sparks; i++) {
      const s = document.createElement("div");
      s.className = "spark";
      s.style.left = `${cx}%`;
      s.style.top  = `${cy}%`;
      s.style.background = colors[Math.floor(Math.random() * colors.length)];

      const ang = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 180;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      s.style.setProperty("--dx", `${dx}px`);
      s.style.setProperty("--dy", `${dy}px`);
      s.style.animationDelay = `${b * 160 + Math.random() * 120}ms`;

      box.appendChild(s);
    }
  }

  setTimeout(() => { box.innerHTML = ""; }, 1400);
}

function ensureTrophyFallback() {
  const img = $("trophyImg");
  const fb = document.querySelector(".trophyFallback");
  if (!img || !fb) return;
  img.onerror = () => {
    img.style.display = "none";
    fb.style.opacity = "1";
  };
}

function showWinnersScreen() {
  const tour = currentTour;
  if (!tour?.winner) return;

  if ($("winnerName")) $("winnerName").textContent = tour.winner.name;

  if ($("winnerRating")) {
    $("winnerRating").innerHTML = `
      <div class="sponsorOnly large">
        Sponsored by: ${tour.winner.sponsor ?? "Your Name Here"}
      </div>
    `;

  const routeEl = $("winnerRoute");
if (routeEl) {
  const route = buildWinnerRoute(tour);

  routeEl.innerHTML = route.length
    ? route.map(r => `
        <div class="routeRow">
          <div class="routeRound">${r.label}</div>
          <div class="routeLine">
            vs <b>${r.opponent}</b> <span class="muted">${r.isAuto ? "(BYE)" : r.score}</span>
          </div>
        </div>
      `).join("")
    : `<div class="muted">No route available.</div>`;
}
  }

  if ($("winnerImg")) $("winnerImg").src = tour.winner.cardImg;
  if ($("winnerSponsor")) $("winnerSponsor").textContent = `Sponsored by: ${tour.winner.sponsor ?? "Your Name Here"}`;

  if ($("bigScorer")) {
    if (tour.awards.bigScorer) {
      const b = tour.awards.bigScorer;
      $("bigScorer").textContent = `${b.teamA.name} ${b.scoreA} — ${b.scoreB} ${b.teamB.name} (Diff ${b.diff})`;
    } else {
      $("bigScorer").textContent = "—";
    }
  }

  if ($("bigLoser")) {
    if (tour.awards.biggestLoser) {
      const bl = tour.awards.biggestLoser;
      $("bigLoser").textContent = `${bl.team.name} — eliminated in ${roundLabel(bl.roundEliminated)}`;
    } else {
      $("bigLoser").textContent = "—";
    }
  }

  setView("viewWinners");
  confettiBurst();
  fireworksBurst(4);
}

// Boot
init();
