// ==========================
// Pit Ballers — Desktop MVP+
// ==========================

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

function baseKeyFromName(name) {
  return name.replaceAll(" ", "_");
}

// Avoid asset collisions when display names repeat (e.g. two "Lolcow Fire")
function buildTeams(names) {
  const counts = new Map();
  return names.map((displayName, idx) => {
    const base = baseKeyFromName(displayName);
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);

    // first occurrence uses base; repeats use base + "__<n>"
    const assetKey = n === 1 ? base : `${base}__${n}`;

    return {
      id: `t${String(idx + 1).padStart(2, "0")}`,
      name: displayName,
      assetKey,
      funny: 50,
      obs: 50,
      cow: 50,
      money: 50,
      cardImg: `img/teams/${assetKey}.png`,
      iconImg: `img/icons/${assetKey}.png`,
    };
  });
}

const TEAMS = buildTeams(TEAM_NAMES);

function overallScore(team) {
  const avg = (team.funny + team.obs + team.cow + team.money) / 4;
  return Math.round(avg);
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
  const views = ["viewHome", "viewH2H", "viewTour", "viewMatch", "viewResults"];
  for (const v of views) $(v).classList.toggle("hidden", v !== name);
}

// --- Arcade icon selector ---
function renderArcadeSelector(containerEl, teams, onPick) {
  containerEl.innerHTML = "";

  teams.forEach((t, i) => {
    const btn = document.createElement("div");
    btn.className = "arcadeIcon";
    btn.dataset.index = String(i);
    btn.dataset.name = t.name;

    const img = document.createElement("img");
    img.src = t.iconImg;
    img.alt = t.name;

    img.onerror = () => {
      img.remove();
      btn.textContent = t.name.split(" ")[1]?.slice(0, 2)?.toUpperCase() ?? "PB";
    };

    btn.appendChild(img);
    btn.addEventListener("click", () => onPick(i));
    containerEl.appendChild(btn);
  });
}

function setArcadeActive(containerEl, index) {
  const icons = containerEl.querySelectorAll(".arcadeIcon");
  icons.forEach(el => el.classList.remove("active"));
  const active = containerEl.querySelector(`.arcadeIcon[data-index="${index}"]`);
  if (active) active.classList.add("active");
}

// --- Carousel ---
function createCarousel(containerEl, teams, initialIndex = 0, variant = "browser") {
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
    img.src = t.cardImg;
    footer.textContent = `Overall Score: ${overallScore(t)}`;

    if (variant === "browser") {
      const arcadeEl = document.getElementById("arcadeSelector");
      if (arcadeEl) setArcadeActive(arcadeEl, idx);
    }
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
    setIndex: (n) => { idx = ((n % teams.length) + teams.length) % teams.length; render(); },
    destroy: () => window.removeEventListener("keydown", onKey),
  };
}

// --- Match simulation (Overall + form RNG) ---
function choose2or3() {
  return Math.random() < 0.7 ? 2 : 3;
}

function computeEffective(overall) {
  const form = randInt(-10, 10);
  const effective = overall * 0.85 + (overall + form) * 0.15;
  return { form, effective };
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
  const denom = (A.effective + B.effective) || 1;
  const pA = A.effective / denom;

  const planned = events.map(e => {
    const scorer = Math.random() < pA ? "A" : "B";
    const points = choose2or3();
    return { ...e, scorer, points };
  });

  return { planned, meta: { A, B, oA, oB } };
}

function runMatchRealtime(teamA, teamB, opts) {
  const { onUpdate, onDone } = opts;
  const DURATION = 30000;
  let speed = 1;

  const { planned, meta } = planMatch(teamA, teamB);

  let scoreA = 0, scoreB = 0;
  let i = 0;
  let rafId = null;
  let done = false;
  let skipped = false;

  const start = performance.now();

  function applyEvent(ev) {
    if (ev.scorer === "A") scoreA += ev.points;
    else scoreB += ev.points;
  }

  function applyRemaining() {
    for (; i < planned.length; i++) applyEvent(planned[i]);
  }

  function frame(now) {
    if (done) return;

    const elapsedReal = now - start;
    const elapsed = elapsedReal * speed;

    while (i < planned.length && planned[i].t <= elapsed) {
      const ev = planned[i];
      applyEvent(ev);
      i++;
      onUpdate?.({ elapsedMs: clamp(elapsed, 0, DURATION), scoreA, scoreB, lastEvent: ev, meta, speed });
    }

    if (elapsed >= DURATION) {
      applyRemaining();
      done = true;
      onDone?.({ scoreA, scoreB, meta, skipped });
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
      done = true;
      onDone?.({ scoreA, scoreB, meta, skipped });
    }
  };
}

// --- Tournament ---
function isBye(t) { return !!t?.isBye; }

function generateBracket32(teams) {
  const shuffled = shuffle(teams);
  const byesNeeded = 32 - shuffled.length; // for 25 teams => 7 BYEs
  const byeObj = () => ({
    id: `bye_${Math.random().toString(16).slice(2)}`,
    name: "BYE",
    isBye: true
  });

  // First N teams get paired with a BYE (ensures no BYE vs BYE)
  const byeTeams = shuffled.slice(0, byesNeeded);
  const remaining = shuffled.slice(byesNeeded);

  const round1 = [];
  let mNum = 1;

  for (const t of byeTeams) {
    round1.push({ a: t, b: byeObj(), round: 1, matchId: `R1M${mNum++}` });
  }
  for (let i = 0; i < remaining.length; i += 2) {
    round1.push({ a: remaining[i], b: remaining[i + 1], round: 1, matchId: `R1M${mNum++}` });
  }

  return {
    rounds: [round1],
    currentRound: 1,
    currentMatchIndex: 0,
    history: [],
    winner: null,
    awards: { bigScorer: null, biggestLoser: null },
    started: true,
  };
}

function roundLabel(roundNum) {
  return roundNum === 1 ? "Round of 32" :
         roundNum === 2 ? "Round of 16" :
         roundNum === 3 ? "Quarterfinals" :
         roundNum === 4 ? "Semifinals" :
         "Final";
}

function buildNextRoundIfNeeded(tour) {
  const roundArr = tour.rounds[tour.currentRound - 1];
  const allResolved = roundArr.every(m => !!m.result);
  if (!allResolved) return;

  const winners = roundArr.map(m => m.result.winner).filter(w => !isBye(w));

  if (winners.length === 1) {
    tour.winner = winners[0];
    return;
  }

  const next = [];
  for (let i = 0; i < winners.length; i += 2) {
    next.push({
      a: winners[i],
      b: winners[i + 1],
      round: tour.currentRound + 1,
      matchId: `R${tour.currentRound + 1}M${i / 2 + 1}`,
    });
  }

  tour.rounds.push(next);
  tour.currentRound++;
  tour.currentMatchIndex = 0;
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

function renderTeamCell(team, side, result) {
  const cell = document.createElement("div");
  cell.className = `teamCell ${side}`;

  if (team && !isBye(team) && team.iconImg) {
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

    const left = document.createElement("div");
    left.textContent = roundLabel(roundNum);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = (roundNum < tour.currentRound) ? "finished (click to expand)" : "click to collapse";

    header.appendChild(left);
    header.appendChild(meta);

    header.addEventListener("click", () => {
      section.classList.toggle("collapsed");
    });

    const body = document.createElement("div");
    body.className = "roundBody";

    for (const m of matches) {
      const line = document.createElement("div");
      line.className = "matchLine";

      const leftTeam = renderTeamCell(m.a, "left", m.result);
      const vs = document.createElement("div");
      vs.className = "vs";
      vs.textContent = "VS";
      const rightTeam = renderTeamCell(m.b, "right", m.result);

      line.appendChild(leftTeam);
      line.appendChild(vs);
      line.appendChild(rightTeam);

      const small = document.createElement("div");
      small.className = "small";

      if (m.result) {
        if (m.result.isAuto) {
          small.textContent = `Auto-advance: ${m.result.winner?.name ?? "—"}`;
        } else {
          small.textContent = `${m.result.scoreA} - ${m.result.scoreB} • Winner: ${m.result.winner.name}`;
        }
      } else if (!isBye(m.a) && isBye(m.b)) {
        small.textContent = `Auto-advance: ${m.a.name}`;
      } else if (isBye(m.a) && !isBye(m.b)) {
        small.textContent = `Auto-advance: ${m.b.name}`;
      } else {
        small.textContent = "Pending";
      }

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
  if (!tour) { el.textContent = "Generate a bracket to begin."; return; }

  const roundArr = tour.rounds[tour.currentRound - 1];
  if (!roundArr) { el.textContent = "Tournament complete."; return; }

  while (tour.currentMatchIndex < roundArr.length) {
    const m = roundArr[tour.currentMatchIndex];

    if (m.result) { tour.currentMatchIndex++; continue; }

    // auto-advance: real team beats BYE
    if (!isBye(m.a) && isBye(m.b)) {
      resolveMatchResult(tour, m, { winner: m.a, loser: m.b, scoreA: 0, scoreB: 0, skipped: true, isAuto: true });
      tour.currentMatchIndex++; continue;
    }
    if (isBye(m.a) && !isBye(m.b)) {
      resolveMatchResult(tour, m, { winner: m.b, loser: m.a, scoreA: 0, scoreB: 0, skipped: true, isAuto: true });
      tour.currentMatchIndex++; continue;
    }

    el.textContent = `Next: ${roundLabel(m.round)} — ${m.a.name} vs ${m.b.name}`;
    return;
  }

  buildNextRoundIfNeeded(tour);
  renderBracket(tour);
  setNextMatchText(tour);
}

// ==========================
// UI Wiring
// ==========================
let browser;
let pickerA, pickerB;
let chosenTeamA = null;
let chosenTeamB = null;

let currentMode = null; // "H2H" | "TOUR"
let currentTour = null;

let matchController = null;
let pendingContinue = null;

function init() {
  browser = createCarousel($("browserCarousel"), TEAMS, 0, "browser");

  const arcadeEl = $("arcadeSelector");
  renderArcadeSelector(arcadeEl, TEAMS, (pickedIndex) => {
    browser.setIndex(pickedIndex);
    setArcadeActive(arcadeEl, pickedIndex);
  });
  setArcadeActive(arcadeEl, browser.getIndex());

  pickerA = createCarousel($("pickA"), TEAMS, 0, "picker");
  pickerB = createCarousel($("pickB"), TEAMS, 1, "picker");

  $("btnHome").addEventListener("click", () => goHome());
  $("goH2H").addEventListener("click", () => {
    currentMode = "H2H";
    setView("viewH2H");
    resetH2H();
  });
  $("goTour").addEventListener("click", () => {
    currentMode = "TOUR";
    setView("viewTour");
    ensureTournamentUI();
  });

  $("setA").addEventListener("click", () => {
    chosenTeamA = pickerA.getTeam();
    $("chosenA").textContent = `${chosenTeamA.name} (Overall ${overallScore(chosenTeamA)})`;
  });
  $("setB").addEventListener("click", () => {
    chosenTeamB = pickerB.getTeam();
    $("chosenB").textContent = `${chosenTeamB.name} (Overall ${overallScore(chosenTeamB)})`;
  });

  $("randH2H").addEventListener("click", () => {
    const i = randInt(0, TEAMS.length - 1);
    let j = randInt(0, TEAMS.length - 1);
    while (j === i) j = randInt(0, TEAMS.length - 1);

    pickerA.setIndex(i);
    pickerB.setIndex(j);

    chosenTeamA = TEAMS[i];
    chosenTeamB = TEAMS[j];

    $("chosenA").textContent = `${chosenTeamA.name} (Overall ${overallScore(chosenTeamA)})`;
    $("chosenB").textContent = `${chosenTeamB.name} (Overall ${overallScore(chosenTeamB)})`;
  });

  $("startH2H").addEventListener("click", () => {
    if (!chosenTeamA || !chosenTeamB || chosenTeamA.id === chosenTeamB.id) return;

    startMatch(chosenTeamA, chosenTeamB, {
      title: "Head-to-Head",
      onComplete: (result) => showResultsH2H(chosenTeamA, chosenTeamB, result),
      continueLabel: "View Results",
    });
  });

  // Tournament controls
  $("genTour").addEventListener("click", () => {
    currentTour = generateBracket32(TEAMS);
    renderBracket(currentTour);
    setNextMatchText(currentTour);
    ensureTournamentUI();
  });

  $("startTour").addEventListener("click", () => {
    if (!currentTour) currentTour = generateBracket32(TEAMS);
    renderBracket(currentTour);
    setNextMatchText(currentTour);
    ensureTournamentUI();
  });

  $("resetTour").addEventListener("click", () => {
    currentTour = null;
    $("winnerCard").classList.add("hidden");
    $("playNext").classList.remove("hidden");
    $("nextMatch").textContent = "Generate a bracket to begin.";
    $("bracket").textContent = "";
    ensureTournamentUI();
  });

  $("playNext").addEventListener("click", () => playNextTournamentMatch());

  // Match controls
  $("speed1").addEventListener("click", () => setSpeedUI(1));
  $("speed2").addEventListener("click", () => setSpeedUI(2));
  $("speed4").addEventListener("click", () => setSpeedUI(4));
  $("skip").addEventListener("click", () => matchController?.skipToEnd());

  $("backAfterMatch").addEventListener("click", () => {
    if (currentMode === "H2H") setView("viewH2H");
    else setView("viewTour");
  });
  $("continueAfterMatch").addEventListener("click", () => pendingContinue?.());

  $("playAgain").addEventListener("click", () => goHome());

  goHome();
}

function goHome() {
  currentMode = null;
  setView("viewHome");
}

function resetH2H() {
  chosenTeamA = null;
  chosenTeamB = null;
  $("chosenA").textContent = "Not set";
  $("chosenB").textContent = "Not set";
}

function ensureTournamentUI() {
  const hasTour = !!currentTour;
  const finished = !!currentTour?.winner;

  // Hide generate/start when in progress OR finished (until reset)
  $("tourControls").classList.toggle("hidden", hasTour);
  $("tourInProgressBar").classList.toggle("hidden", !hasTour);

  // Play next hidden when finished
  $("playNext").classList.toggle("hidden", finished);

  // Winner card shown when finished
  $("winnerCard").classList.toggle("hidden", !finished);
}

function setSpeedUI(speed) {
  for (const [id, s] of [["speed1", 1], ["speed2", 2], ["speed4", 4]]) {
    $(id).classList.toggle("active", s === speed);
  }
  matchController?.setSpeed(speed);
}

function flashScorer(which) {
  const el = which === "A" ? $("mTeamA") : $("mTeamB");
  el.classList.remove("flash");
  // force reflow so animation can retrigger rapidly
  void el.offsetWidth;
  el.classList.add("flash");
}

function hydrateMatchCards(teamA, teamB) {
  $("mcNameA").textContent = teamA.name;
  $("mcImgA").src = teamA.cardImg;
  $("mcOverallA").textContent = `Overall Score: ${overallScore(teamA)}`;

  $("mcNameB").textContent = teamB.name;
  $("mcImgB").src = teamB.cardImg;
  $("mcOverallB").textContent = `Overall Score: ${overallScore(teamB)}`;
}

function startMatch(teamA, teamB, opts) {
  setView("viewMatch");

  $("matchTitle").textContent = opts.title ?? "Match";
  $("mTeamA").textContent = teamA.name;
  $("mTeamB").textContent = teamB.name;
  $("mScoreA").textContent = "0";
  $("mScoreB").textContent = "0";
  $("lastEvent").textContent = "—";
  $("mClock").textContent = "30.0s";

  hydrateMatchCards(teamA, teamB);

  $("backAfterMatch").classList.add("hidden");
  $("continueAfterMatch").classList.add("hidden");

  setSpeedUI(1);
  matchController = null;
  pendingContinue = null;

  matchController = runMatchRealtime(teamA, teamB, {
    onUpdate: ({ elapsedMs, scoreA, scoreB, lastEvent }) => {
      const remaining = Math.max(0, 30000 - elapsedMs);
      $("mClock").textContent = `${(remaining / 1000).toFixed(1)}s`;
      $("mScoreA").textContent = String(scoreA);
      $("mScoreB").textContent = String(scoreB);

      if (lastEvent) {
        const who = lastEvent.scorer === "A" ? teamA.name : teamB.name;
        $("lastEvent").textContent = `${who} +${lastEvent.points}`;
        flashScorer(lastEvent.scorer);
      }
    },
    onDone: (res) => {
      $("mScoreA").textContent = String(res.scoreA);
      $("mScoreB").textContent = String(res.scoreB);
      $("mClock").textContent = `0.0s`;
      $("lastEvent").textContent = res.skipped ? "Skipped to end." : "Final.";

      $("continueAfterMatch").classList.remove("hidden");
      $("backAfterMatch").classList.remove("hidden");

      pendingContinue = () => opts.onComplete?.(res);
      $("continueAfterMatch").textContent = opts.continueLabel ?? "Continue";
    }
  });
}

function showResultsH2H(teamA, teamB, result) {
  const winner = result.scoreA === result.scoreB
    ? (Math.random() < 0.5 ? teamA : teamB)
    : (result.scoreA > result.scoreB ? teamA : teamB);

  const body = $("resultsBody");
  body.innerHTML = "";
  body.appendChild(resultItem("Winner", winner.name));
  body.appendChild(resultItem("Final Score", `${teamA.name} ${result.scoreA} — ${result.scoreB} ${teamB.name}`));

  setView("viewResults");
}

function playNextTournamentMatch() {
  if (!currentTour) return;

  setNextMatchText(currentTour);
  ensureTournamentUI();

  if (currentTour.winner) {
    showTournamentWinnerCard();
    return;
  }

  const roundArr = currentTour.rounds[currentTour.currentRound - 1];
  if (!roundArr) return;

  let m = null;
  while (currentTour.currentMatchIndex < roundArr.length) {
    const candidate = roundArr[currentTour.currentMatchIndex];
    if (!candidate.result && !isBye(candidate.a) && !isBye(candidate.b)) { m = candidate; break; }
    currentTour.currentMatchIndex++;
  }

  if (!m) {
    buildNextRoundIfNeeded(currentTour);
    setNextMatchText(currentTour);
    renderBracket(currentTour);
    ensureTournamentUI();
    if (currentTour.winner) showTournamentWinnerCard();
    return;
  }

  startMatch(m.a, m.b, {
    title: `Tournament — ${roundLabel(m.round)}`,
    continueLabel: "Continue Tournament",
    onComplete: (res) => {
      let winner, loser;

      if (res.scoreA === res.scoreB) {
        winner = Math.random() < 0.5 ? m.a : m.b;
        loser  = (winner.id === m.a.id) ? m.b : m.a;
      } else if (res.scoreA > res.scoreB) {
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
      renderBracket(currentTour);
      setNextMatchText(currentTour);

      setView("viewTour");
      ensureTournamentUI();

      if (currentTour.winner) {
        showTournamentWinnerCard();
      }
    }
  });
}

function showTournamentWinnerCard() {
  if (!currentTour?.winner) return;

  const w = currentTour.winner;
  $("winnerName").textContent = w.name;
  $("winnerOverall").textContent = `Overall Score: ${overallScore(w)}`;
  $("winnerImg").src = w.cardImg;

  $("winnerCard").classList.remove("hidden");
  $("playNext").classList.add("hidden");
  $("nextMatch").textContent = "Tournament complete.";
  ensureTournamentUI();
}

function resultItem(k, v) {
  const d = document.createElement("div");
  d.className = "resultItem";
  d.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
  return d;
}

init();
