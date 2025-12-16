// ==========================
// Pit Ballers — v2 UI + 4 ratings
// ==========================

const TEAM_NAMES = [
  "Lolcow Balls",
  "Lolcow Pit",
  "Lolcow Queens",
  "Lolcow Live (a)",
  "Lolcow Live (b)",
  "Lolcow Rebel",
  "Lolcow Nerds",
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
  "Lolcow Cash",
  "Lolcow Wild",
  "Lolcow Mods",
  "Lolcow Keem",
  "Lolcow Losers",
  "Lolcow Acorn",
  "Lolcow Wings",
  "Lolcow Bus",
];

function fileFromName(name) {
  return name.replaceAll(" ", "_");
}

const TEAMS = TEAM_NAMES.map((name, idx) => ({
  id: `t${String(idx + 1).padStart(2, "0")}`,
  name,
  funny: 50,
  obs: 50,
  cow: 50,
  money: 50,
  cardImg: `img/teams/${fileFromName(name)}.png`,
}));

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

// --- Carousel (browser = 1920, picker = 960) ---
function createCarousel(containerEl, teams, initialIndex = 0, variant = "browser") {
  let idx = initialIndex;

  containerEl.classList.toggle("browser", variant === "browser");
  containerEl.classList.toggle("picker", variant === "picker");

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

// --- Match simulation (overall + form RNG) ---
function choose2or3() {
  return Math.random() < 0.7 ? 2 : 3;
}

function computeEffective(overall) {
  // Base dominates; form is lighter
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
function generateBracket32(teams) {
  const shuffled = shuffle(teams);

  const slots = [];
  for (const t of shuffled) slots.push(t);
  while (slots.length < 32) slots.push({ id: `bye${slots.length}`, name: "BYE", isBye: true });

  const round1 = [];
  for (let i = 0; i < 32; i += 2) {
    round1.push({ a: slots[i], b: slots[i + 1], round: 1, matchId: `R1M${i / 2 + 1}` });
  }

  return {
    rounds: [round1],
    currentRound: 1,
    currentMatchIndex: 0,
    history: [],
    winner: null,
    awards: { bigScorer: null, biggestLoser: null },
  };
}

function isBye(t) { return !!t?.isBye; }

function renderBracket(tour) {
  const el = $("bracket");
  if (!tour) { el.textContent = "No bracket yet."; return; }
  el.innerHTML = "";

  for (let r = 0; r < tour.rounds.length; r++) {
    const roundNum = r + 1;
    const title = document.createElement("div");
    title.className = "roundTitle";
    title.textContent = roundNum === 1 ? "Round of 32" :
                        roundNum === 2 ? "Round of 16" :
                        roundNum === 3 ? "Quarterfinals" :
                        roundNum === 4 ? "Semifinals" :
                        "Final";
    el.appendChild(title);

    for (const m of tour.rounds[r]) {
      const line = document.createElement("div");
      line.className = "matchLine";

      const left = document.createElement("div");
      left.textContent = m.a?.name ?? "—";

      const vs = document.createElement("div");
      vs.className = "vs";
      vs.textContent = "VS";

      const right = document.createElement("div");
      right.style.textAlign = "right";
      right.textContent = m.b?.name ?? "—";

      line.appendChild(left);
      line.appendChild(vs);
      line.appendChild(right);

      const small = document.createElement("div");
      small.className = "small";
      small.style.gridColumn = "1 / -1";

      if (m.result) {
        small.textContent = `${m.result.scoreA} - ${m.result.scoreB} • Winner: ${m.result.winner.name}`;
      } else if (isBye(m.a) && !isBye(m.b)) {
        small.textContent = `Auto-advance: ${m.b.name}`;
      } else if (!isBye(m.a) && isBye(m.b)) {
        small.textContent = `Auto-advance: ${m.a.name}`;
      } else if (isBye(m.a) && isBye(m.b)) {
        small.textContent = `BYE vs BYE (ignored)`;
      } else {
        small.textContent = `Pending`;
      }

      line.appendChild(small);
      el.appendChild(line);
    }
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

    if (isBye(m.a) && !isBye(m.b)) {
      resolveMatchResult(tour, m, { winner: m.b, loser: m.a, scoreA: 0, scoreB: 0, skipped: true, isAuto: true });
      tour.currentMatchIndex++; continue;
    }
    if (!isBye(m.a) && isBye(m.b)) {
      resolveMatchResult(tour, m, { winner: m.a, loser: m.b, scoreA: 0, scoreB: 0, skipped: true, isAuto: true });
      tour.currentMatchIndex++; continue;
    }
    if (isBye(m.a) && isBye(m.b)) {
      resolveMatchResult(tour, m, { winner: m.a, loser: m.b, scoreA: 0, scoreB: 0, skipped: true, isAuto: true });
      tour.currentMatchIndex++; continue;
    }

    el.textContent = `Round ${m.round}: ${m.a.name} vs ${m.b.name}`;
    return;
  }

  buildNextRoundIfNeeded(tour);
  setNextMatchText(tour);
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
    resetTournamentUI();
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

  $("genTour").addEventListener("click", () => {
    currentTour = generateBracket32(TEAMS);
    renderBracket(currentTour);
    setNextMatchText(currentTour);
  });

  $("startTour").addEventListener("click", () => {
    if (!currentTour) currentTour = generateBracket32(TEAMS);
    renderBracket(currentTour);
    setNextMatchText(currentTour);
  });

  $("playNext").addEventListener("click", () => playNextTournamentMatch());

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

function resetTournamentUI() {
  renderBracket(currentTour);
  setNextMatchText(currentTour);
}

function setSpeedUI(speed) {
  for (const [id, s] of [["speed1", 1], ["speed2", 2], ["speed4", 4]]) {
    $(id).classList.toggle("active", s === speed);
  }
  matchController?.setSpeed(speed);
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

  if (currentTour.winner) {
    showTournamentResults();
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
    if (currentTour.winner) showTournamentResults();
    return;
  }

  startMatch(m.a, m.b, {
    title: `Tournament — Round ${m.round}`,
    continueLabel: "Continue Tournament",
    onComplete: (res) => {
      let winner, loser;
      if (res.scoreA === res.scoreB) {
        winner = Math.random() < 0.5 ? m.a : m.b;
        loser  = winner.id === m.a.id ? m.b : m.a;
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
      if (currentTour.winner) showTournamentResults();
    }
  });
}

function showTournamentResults() {
  const tour = currentTour;
  const body = $("resultsBody");
  body.innerHTML = "";

  body.appendChild(resultItem("Tournament Winner", tour.winner?.name ?? "—"));

  if (tour.awards.bigScorer) {
    const b = tour.awards.bigScorer;
    body.appendChild(resultItem(
      "Big Scorer (Largest Point Spread)",
      `${b.teamA.name} ${b.scoreA} — ${b.scoreB} ${b.teamB.name} (Diff ${b.diff})`
    ));
  } else {
    body.appendChild(resultItem("Big Scorer (Largest Point Spread)", "—"));
  }

  if (tour.awards.biggestLoser) {
    const bl = tour.awards.biggestLoser;
    body.appendChild(resultItem(
      "Biggest Loser (Earliest Knockout w/ Highest Overall)",
      `${bl.team.name} (Overall ${overallScore(bl.team)}) — eliminated in Round ${bl.roundEliminated}`
    ));
  } else {
    body.appendChild(resultItem("Biggest Loser (Earliest Knockout w/ Highest Overall)", "—"));
  }

  setView("viewResults");
}

function resultItem(k, v) {
  const d = document.createElement("div");
  d.className = "resultItem";
  d.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
  return d;
}

init();
