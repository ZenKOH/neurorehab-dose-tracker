const APP_KEY = "neurorehabDoseTracker.v2";
const LEGACY_SESSIONS_KEY = "neurorehabDoseTracker.sessions.v1";

const $ = (id) => document.getElementById(id);

const DEFAULT_STATE = {
  schemaVersion: 2,
  cases: [],
  sessions: [],
  outcomes: [],
  exports: []
};

let state = loadState();

function uid(prefix) {
  if (window.crypto && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const d = new Date(date + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isThisWeek(dateString) {
  if (!dateString) return false;
  const start = startOfWeek(todayISO());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const date = new Date(dateString + "T12:00:00");
  return date >= start && date < end;
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const now = new Date(todayISO() + "T00:00:00");
  const target = new Date(dateString + "T00:00:00");
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function pct(value, target) {
  if (!target || Number(target) <= 0) return 0;
  return Math.min(100, Math.round((Number(value || 0) / Number(target)) * 100));
}

function avg(values) {
  const clean = values.map(Number).filter((v) => Number.isFinite(v));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : 0;
}

function formatDate(dateString) {
  if (!dateString) return "No date";
  return new Date(dateString + "T12:00:00").toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(APP_KEY));
    if (saved && saved.schemaVersion === 2) {
      return {
        schemaVersion: 2,
        cases: Array.isArray(saved.cases) ? saved.cases : [],
        sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
        outcomes: Array.isArray(saved.outcomes) ? saved.outcomes : [],
        exports: Array.isArray(saved.exports) ? saved.exports : []
      };
    }
  } catch {
    // fall through to legacy migration
  }

  try {
    const legacySessions = JSON.parse(localStorage.getItem(LEGACY_SESSIONS_KEY)) || [];
    if (Array.isArray(legacySessions) && legacySessions.length) {
      const importedCaseId = uid("case");
      return {
        schemaVersion: 2,
        cases: [{
          id: importedCaseId,
          label: "Imported legacy case",
          diagnosis: "Other neurological condition",
          phase: "Outpatient",
          domain: "Mixed programme",
          primaryGoal: "Review imported sessions and assign a current functional goal.",
          secondaryGoals: "",
          weeklyMinutes: 180,
          weeklyReps: 1000,
          minimumQuality: 3,
          reviewDate: todayISO(),
          clinician: "",
          precautions: "Legacy data imported from the earlier dose tracker.",
          createdAt: new Date().toISOString()
        }],
        sessions: legacySessions.map((s) => ({
          id: s.id || uid("session"),
          caseId: importedCaseId,
          date: s.date || todayISO(),
          setting: "Clinic",
          task: s.task || "Imported session",
          minutes: Number(s.minutes || 0),
          activeMinutes: Number(s.minutes || 0),
          reps: Number(s.reps || 0),
          quality: Number(s.quality || 3),
          fatigue: Number(s.fatigue || 0),
          pain: 0,
          assistance: "Mixed assist",
          challenge: "Appropriate",
          specificity: "Partially linked to functional goal",
          carryover: s.carryover || "Not assessed",
          homeAdherence: "Not reported",
          restBreaks: 0,
          notes: s.notes || "",
          createdAt: new Date().toISOString()
        })),
        outcomes: [],
        exports: []
      };
    }
  } catch {
    // ignore legacy parse errors
  }

  return structuredClone(DEFAULT_STATE);
}

function saveState() {
  localStorage.setItem(APP_KEY, JSON.stringify(state));
}

function selectedReviewCaseId() {
  const value = $("reviewCaseFilter")?.value;
  return value === "all" ? null : value;
}

function getCase(caseId) {
  return state.cases.find((c) => c.id === caseId);
}

function sessionsForCase(caseId) {
  return state.sessions.filter((s) => s.caseId === caseId);
}

function outcomesForCase(caseId) {
  return state.outcomes.filter((o) => o.caseId === caseId);
}

function weeklySessionsForCase(caseId) {
  return sessionsForCase(caseId).filter((s) => isThisWeek(s.date));
}

function calculateCaseStats(programme) {
  const weekly = weeklySessionsForCase(programme.id);
  const allSessions = sessionsForCase(programme.id);
  const activeMinutes = weekly.reduce((sum, s) => sum + Number(s.activeMinutes || 0), 0);
  const scheduledMinutes = weekly.reduce((sum, s) => sum + Number(s.minutes || 0), 0);
  const reps = weekly.reduce((sum, s) => sum + Number(s.reps || 0), 0);
  const quality = avg(weekly.map((s) => s.quality));
  const fatigue = avg(weekly.map((s) => s.fatigue));
  const pain = avg(weekly.map((s) => s.pain));
  const carryoverPositive = weekly.filter((s) => s.carryover === "Yes, in daily activity" || s.carryover === "Partial").length;
  const carryoverAssessed = weekly.filter((s) => s.carryover !== "Not assessed").length;
  const highFatigueLowQuality = weekly.filter((s) => Number(s.fatigue) >= 8 && Number(s.quality) <= 2);
  const highPain = weekly.filter((s) => Number(s.pain) >= 7);
  const difficult = weekly.filter((s) => s.challenge === "Too difficult");
  const lowHome = weekly.filter((s) => s.homeAdherence === "Low");
  const noFunctionalLink = weekly.filter((s) => s.specificity === "Unclear link");
  const reviewDue = daysUntil(programme.reviewDate);
  const latestSession = [...allSessions].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

  return {
    weekly,
    allSessions,
    activeMinutes,
    scheduledMinutes,
    reps,
    quality,
    fatigue,
    pain,
    carryoverPositive,
    carryoverAssessed,
    carryoverRate: carryoverAssessed ? Math.round((carryoverPositive / carryoverAssessed) * 100) : 0,
    highFatigueLowQuality,
    highPain,
    difficult,
    lowHome,
    noFunctionalLink,
    reviewDue,
    latestSession,
    minutesPct: pct(activeMinutes, programme.weeklyMinutes),
    repsPct: pct(reps, programme.weeklyReps)
  };
}

function reviewItemsForCase(programme) {
  const stats = calculateCaseStats(programme);
  const items = [];

  if (!stats.weekly.length) {
    items.push({
      severity: "warning",
      title: "No session logged this week",
      trigger: `${programme.label}: 0 sessions in the current week.`,
      interpretation: "The programme may be losing continuity or the app may not yet be part of the workflow.",
      review: "Check whether therapy occurred but was not recorded, whether home practice was missed, or whether the case should be paused."
    });
  }

  if (stats.activeMinutes < Number(programme.weeklyMinutes || 0) * 0.5) {
    items.push({
      severity: "warning",
      title: "Active practice dose is below half of target",
      trigger: `${stats.activeMinutes} active minutes recorded against a weekly target of ${programme.weeklyMinutes}.`,
      interpretation: "Scheduled time may not be translating into enough active practice.",
      review: "Review barriers such as fatigue, transport, setup time, motivation, staffing, task difficulty, or home practice feasibility."
    });
  }

  if (stats.reps < Number(programme.weeklyReps || 0) * 0.5) {
    items.push({
      severity: "warning",
      title: "Repetition volume is below half of target",
      trigger: `${stats.reps} repetitions recorded against a weekly target of ${programme.weeklyReps}.`,
      interpretation: "The motor learning dose may be too low to support the intended functional goal.",
      review: "Consider shorter but more frequent bouts, simpler tasks, assisted practice, or a clearer home-practice plan."
    });
  }

  if (stats.highFatigueLowQuality.length) {
    items.push({
      severity: "risk",
      title: "High fatigue with low movement quality",
      trigger: `${stats.highFatigueLowQuality.length} session(s) recorded fatigue >= 8/10 and quality <= 2/5.`,
      interpretation: "The programme may be pushing intensity at the expense of movement quality.",
      review: "Review rest intervals, challenge level, compensation patterns, safety, and whether the target dose is clinically tolerable."
    });
  }

  if (stats.highPain.length) {
    items.push({
      severity: "risk",
      title: "Pain or discomfort needs review",
      trigger: `${stats.highPain.length} session(s) recorded pain/discomfort >= 7/10.`,
      interpretation: "Pain may be limiting safe participation or distorting movement quality.",
      review: "Review precautions, task selection, intensity, and whether additional clinical assessment is needed."
    });
  }

  if (stats.weekly.length >= 2 && stats.carryoverAssessed >= 2 && stats.carryoverPositive === 0) {
    items.push({
      severity: "warning",
      title: "No functional carryover despite repeated sessions",
      trigger: `${stats.carryoverAssessed} assessed session(s), 0 with full or partial carryover.`,
      interpretation: "The programme may be producing session activity without transfer into daily function.",
      review: "Review task specificity, home environment, patient goals, caregiver support, and whether the task practised is the right functional bridge."
    });
  }

  if (stats.difficult.length >= 2) {
    items.push({
      severity: "warning",
      title: "Challenge may be too high",
      trigger: `${stats.difficult.length} session(s) marked Too difficult.`,
      interpretation: "Repeated excessive challenge can reduce practice volume, movement quality, confidence, or adherence.",
      review: "Consider grading the task, increasing assistance, changing the environment, or splitting the task into smaller components."
    });
  }

  if (stats.lowHome.length >= 2) {
    items.push({
      severity: "warning",
      title: "Home adherence is low",
      trigger: `${stats.lowHome.length} session(s) marked low home adherence.`,
      interpretation: "The programme may not be simple enough to repeat outside supervised care.",
      review: "Review caregiver support, instructions, environmental barriers, time burden, and whether the home task maps to the patient’s daily routine."
    });
  }

  if (stats.noFunctionalLink.length) {
    items.push({
      severity: "info",
      title: "Task specificity is unclear",
      trigger: `${stats.noFunctionalLink.length} session(s) had an unclear link to the functional goal.`,
      interpretation: "Dose is more useful when the practised task is tied to the target activity.",
      review: "Clarify the relationship between the exercise and the functional goal, or update the goal if the programme focus has changed."
    });
  }

  if (stats.reviewDue !== null && stats.reviewDue <= 0) {
    items.push({
      severity: "warning",
      title: "Programme review is due",
      trigger: `Review date was ${formatDate(programme.reviewDate)}.`,
      interpretation: "A scheduled review prevents stale goals, inappropriate targets, and silent drift in the plan.",
      review: "Update goals, targets, precautions, and outcome measures after clinician review."
    });
  }

  if (
    stats.weekly.length &&
    stats.activeMinutes >= Number(programme.weeklyMinutes || 0) &&
    stats.reps >= Number(programme.weeklyReps || 0) &&
    stats.quality >= Number(programme.minimumQuality || 0)
  ) {
    items.push({
      severity: "good",
      title: "Dose and quality targets are being met",
      trigger: `${stats.activeMinutes} active minutes, ${stats.reps} repetitions, average quality ${stats.quality.toFixed(1)}/5.`,
      interpretation: "The programme is meeting the current quantitative targets.",
      review: "The next clinical question is whether these gains are transferring into outcome measures and daily activity."
    });
  }

  if (!items.length) {
    items.push({
      severity: "good",
      title: "No major review flags generated",
      trigger: "Current weekly entries do not cross the configured review thresholds.",
      interpretation: "The programme has enough data for routine review but no current rule-based concern.",
      review: "Continue collecting dose, quality, fatigue, pain, carryover, and outcome data."
    });
  }

  return items;
}

function allReviewItems() {
  if (!state.cases.length) {
    return [{
      severity: "warning",
      title: "No programme created",
      trigger: "The app has no case/programme yet.",
      interpretation: "Clinical adoption requires a programme layer: goals, targets, precautions, outcomes and therapist responsibility.",
      review: "Create a programme first, then add sessions and outcome measures."
    }];
  }

  const selected = selectedReviewCaseId();
  const programmes = selected ? state.cases.filter((c) => c.id === selected) : state.cases;
  return programmes.flatMap(reviewItemsForCase);
}

function renderProgrammeSelectors() {
  const options = state.cases.map((c) => `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join("");
  const empty = `<option value="">Create a programme first</option>`;
  $("sessionCaseId").innerHTML = options || empty;
  $("outcomeCaseId").innerHTML = options || empty;

  const currentFilter = $("reviewCaseFilter").value || "all";
  $("reviewCaseFilter").innerHTML = `<option value="all">All cases</option>${options}`;
  if (currentFilter === "all" || state.cases.some((c) => c.id === currentFilter)) {
    $("reviewCaseFilter").value = currentFilter;
  }
}

function renderStats() {
  const selected = selectedReviewCaseId();
  const programmes = selected ? state.cases.filter((c) => c.id === selected) : state.cases;
  const weekly = programmes.flatMap((c) => weeklySessionsForCase(c.id));
  const totalMinutes = weekly.reduce((sum, s) => sum + Number(s.activeMinutes || 0), 0);
  const totalReps = weekly.reduce((sum, s) => sum + Number(s.reps || 0), 0);
  const averageQuality = avg(weekly.map((s) => s.quality));
  const reviewCount = state.cases.filter((c) => reviewItemsForCase(c).some((item) => item.severity === "warning" || item.severity === "risk")).length;

  $("minutesThisWeek").textContent = totalMinutes;
  $("repsThisWeek").textContent = totalReps;
  $("avgQuality").textContent = averageQuality.toFixed(1);
  $("casesNeedingReview").textContent = reviewCount;

  const targetMinutes = programmes.reduce((sum, c) => sum + Number(c.weeklyMinutes || 0), 0);
  const targetReps = programmes.reduce((sum, c) => sum + Number(c.weeklyReps || 0), 0);
  const minutesPct = pct(totalMinutes, targetMinutes);
  const repsPct = pct(totalReps, targetReps);
  $("minutesBar").style.width = `${minutesPct}%`;
  $("repsBar").style.width = `${repsPct}%`;
  $("minutesPct").textContent = `${minutesPct}%`;
  $("repsPct").textContent = `${repsPct}%`;
}

function renderCaseTable() {
  if (!state.cases.length) {
    $("caseTable").innerHTML = `<tr><td colspan="7" class="empty">No programmes yet.</td></tr>`;
    return;
  }

  $("caseTable").innerHTML = state.cases.map((c) => {
    const stats = calculateCaseStats(c);
    const items = reviewItemsForCase(c);
    const topFlag = items.find((item) => item.severity === "risk") || items.find((item) => item.severity === "warning") || items[0];
    return `
      <tr>
        <td><strong>${escapeHtml(c.label)}</strong><br><span>${escapeHtml(c.diagnosis)} · ${escapeHtml(c.phase)}</span></td>
        <td>${escapeHtml(c.primaryGoal)}</td>
        <td>${stats.activeMinutes}/${Number(c.weeklyMinutes || 0)} min<br>${stats.reps}/${Number(c.weeklyReps || 0)} reps</td>
        <td>${stats.quality ? stats.quality.toFixed(1) : "0.0"}/5</td>
        <td>${stats.fatigue ? stats.fatigue.toFixed(1) : "0.0"}/10</td>
        <td>${stats.carryoverAssessed ? `${stats.carryoverRate}%` : "Not assessed"}</td>
        <td><span class="badge ${topFlag.severity}">${escapeHtml(topFlag.title)}</span></td>
      </tr>
    `;
  }).join("");
}

function renderInsights() {
  const items = allReviewItems();
  $("insights").innerHTML = items.map((item) => `
    <article class="insight ${item.severity}">
      <div class="insight-top">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="badge ${item.severity}">${escapeHtml(item.severity === "risk" ? "Review recommended" : item.severity)}</span>
      </div>
      <p><b>Trigger:</b> ${escapeHtml(item.trigger)}</p>
      <p><b>Interpretation:</b> ${escapeHtml(item.interpretation)}</p>
      <p><b>Clinician review:</b> ${escapeHtml(item.review)}</p>
    </article>
  `).join("");
}

function renderOutcomes() {
  const selected = selectedReviewCaseId();
  const outcomes = selected ? state.outcomes.filter((o) => o.caseId === selected) : state.outcomes;
  if (!outcomes.length) {
    $("outcomesList").innerHTML = `<p class="empty">No outcome measures recorded yet.</p>`;
    return;
  }

  $("outcomesList").innerHTML = [...outcomes]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((o) => {
      const c = getCase(o.caseId);
      return `
        <article class="session-item">
          <div class="session-top">
            <div>
              <div class="session-title">${escapeHtml(o.name)} · ${escapeHtml(c?.label || "Unknown case")}</div>
              <div class="session-meta">
                ${formatDate(o.date)} · baseline: ${escapeHtml(o.baseline || "—")} · current: ${escapeHtml(o.current || "—")} · target: ${escapeHtml(o.target || "—")} · ${escapeHtml(o.direction)}
              </div>
            </div>
            <button class="delete-outcome danger" data-id="${o.id}">Delete</button>
          </div>
          ${o.note ? `<p class="session-notes">${escapeHtml(o.note)}</p>` : ""}
        </article>
      `;
    }).join("");

  document.querySelectorAll(".delete-outcome").forEach((button) => {
    button.addEventListener("click", () => {
      state.outcomes = state.outcomes.filter((o) => o.id !== button.dataset.id);
      saveState();
      render();
    });
  });
}

function renderSessions() {
  const selected = selectedReviewCaseId();
  const sessions = selected ? state.sessions.filter((s) => s.caseId === selected) : state.sessions;
  if (!sessions.length) {
    $("sessionsList").innerHTML = `<p class="empty">No sessions saved yet.</p>`;
    return;
  }

  $("sessionsList").innerHTML = [...sessions]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 16)
    .map((s) => {
      const c = getCase(s.caseId);
      return `
        <article class="session-item">
          <div class="session-top">
            <div>
              <div class="session-title">${escapeHtml(s.task)} · ${escapeHtml(c?.label || "Unknown case")}</div>
              <div class="session-meta">
                ${formatDate(s.date)} · ${escapeHtml(s.setting)}<br />
                active ${s.activeMinutes} min / scheduled ${s.minutes} min · ${s.reps} reps · quality ${s.quality}/5 · fatigue ${s.fatigue}/10 · pain ${s.pain}/10<br />
                ${escapeHtml(s.assistance)} · ${escapeHtml(s.challenge)} · carryover: ${escapeHtml(s.carryover)} · home: ${escapeHtml(s.homeAdherence)}
              </div>
            </div>
            <button class="delete-session danger" data-id="${s.id}">Delete</button>
          </div>
          ${s.notes ? `<p class="session-notes">${escapeHtml(s.notes)}</p>` : ""}
        </article>
      `;
    }).join("");

  document.querySelectorAll(".delete-session").forEach((button) => {
    button.addEventListener("click", () => {
      state.sessions = state.sessions.filter((s) => s.id !== button.dataset.id);
      saveState();
      render();
    });
  });
}

function renderEvidenceSummary() {
  const sessions = state.sessions.length;
  const cases = state.cases.length;
  const outcomes = state.outcomes.length;
  const carryoverAssessed = state.sessions.filter((s) => s.carryover !== "Not assessed").length;
  const carryoverPositive = state.sessions.filter((s) => s.carryover === "Yes, in daily activity" || s.carryover === "Partial").length;
  const homeTracked = state.sessions.filter((s) => s.homeAdherence !== "Not applicable" && s.homeAdherence !== "Not reported").length;
  const reviewPrompts = allReviewItems().length;

  const cards = [
    ["Programmes", cases],
    ["Sessions", sessions],
    ["Outcome measures", outcomes],
    ["Carryover rate", carryoverAssessed ? `${Math.round((carryoverPositive / carryoverAssessed) * 100)}%` : "Not assessed"],
    ["Home-adherence entries", homeTracked],
    ["Review prompts", reviewPrompts]
  ];

  $("evidenceSummary").innerHTML = cards.map(([label, value]) => `
    <div class="evidence-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function render() {
  renderProgrammeSelectors();
  renderStats();
  renderCaseTable();
  renderInsights();
  renderOutcomes();
  renderSessions();
  renderEvidenceSummary();
}

function saveProgramme(event) {
  event.preventDefault();
  const id = $("caseId").value || uid("case");
  const programme = {
    id,
    label: $("caseLabel").value.trim(),
    diagnosis: $("diagnosis").value,
    phase: $("phase").value,
    domain: $("domain").value,
    primaryGoal: $("primaryGoal").value.trim(),
    secondaryGoals: $("secondaryGoals").value.trim(),
    weeklyMinutes: Number($("weeklyMinutes").value),
    weeklyReps: Number($("weeklyReps").value),
    minimumQuality: Number($("minimumQuality").value),
    reviewDate: $("reviewDate").value,
    clinician: $("clinician").value.trim(),
    precautions: $("precautions").value.trim(),
    createdAt: state.cases.find((c) => c.id === id)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.cases = state.cases.filter((c) => c.id !== id).concat(programme);
  saveState();
  event.target.reset();
  $("caseId").value = "";
  $("reviewDate").value = todayISO();
  render();
}

function saveSession(event) {
  event.preventDefault();
  if (!$("sessionCaseId").value) {
    alert("Create a programme before logging a session.");
    return;
  }

  const session = {
    id: uid("session"),
    caseId: $("sessionCaseId").value,
    date: $("date").value,
    setting: $("setting").value,
    task: $("task").value.trim(),
    minutes: Number($("minutes").value),
    activeMinutes: Number($("activeMinutes").value),
    reps: Number($("reps").value),
    quality: Number($("quality").value),
    fatigue: Number($("fatigue").value),
    pain: Number($("pain").value),
    assistance: $("assistance").value,
    challenge: $("challenge").value,
    specificity: $("specificity").value,
    carryover: $("carryover").value,
    homeAdherence: $("homeAdherence").value,
    restBreaks: Number($("restBreaks").value),
    notes: $("notes").value.trim(),
    createdAt: new Date().toISOString()
  };

  state.sessions.push(session);
  saveState();
  event.target.reset();
  setSessionDefaults();
  render();
}

function saveOutcome(event) {
  event.preventDefault();
  if (!$("outcomeCaseId").value) {
    alert("Create a programme before recording an outcome.");
    return;
  }

  const outcome = {
    id: uid("outcome"),
    caseId: $("outcomeCaseId").value,
    name: $("outcomeName").value.trim(),
    baseline: $("baselineValue").value.trim(),
    current: $("currentValue").value.trim(),
    target: $("targetValue").value.trim(),
    date: $("outcomeDate").value || todayISO(),
    direction: $("outcomeDirection").value,
    note: $("outcomeNote").value.trim(),
    createdAt: new Date().toISOString()
  };

  state.outcomes.push(outcome);
  saveState();
  event.target.reset();
  $("outcomeDate").value = todayISO();
  render();
}

function setSessionDefaults() {
  $("date").value = todayISO();
  $("minutes").value = 30;
  $("activeMinutes").value = 25;
  $("reps").value = 100;
  $("quality").value = 3;
  $("fatigue").value = 4;
  $("pain").value = 0;
  $("restBreaks").value = 1;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadBlob(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  state.exports.push({ id: uid("export"), filename, createdAt: new Date().toISOString() });
  saveState();
  renderEvidenceSummary();
}

function exportCsv() {
  const headers = [
    "caseLabel", "diagnosis", "phase", "primaryGoal", "date", "setting", "task", "scheduledMinutes",
    "activeMinutes", "repetitions", "quality", "fatigue", "pain", "assistance", "challenge",
    "specificity", "carryover", "homeAdherence", "restBreaks", "notes"
  ];

  const rows = state.sessions.map((s) => {
    const c = getCase(s.caseId) || {};
    return [
      c.label, c.diagnosis, c.phase, c.primaryGoal, s.date, s.setting, s.task, s.minutes,
      s.activeMinutes, s.reps, s.quality, s.fatigue, s.pain, s.assistance, s.challenge,
      s.specificity, s.carryover, s.homeAdherence, s.restBreaks, s.notes
    ].map(csvCell).join(",");
  });

  downloadBlob(`neurorehab-dose-tracker-${todayISO()}.csv`, [headers.join(","), ...rows].join("\n"), "text/csv;charset=utf-8");
}

function buildProgressNote() {
  const selected = selectedReviewCaseId();
  const programmes = selected ? state.cases.filter((c) => c.id === selected) : state.cases;

  if (!programmes.length) {
    return "No programme data available.";
  }

  return programmes.map((c) => {
    const stats = calculateCaseStats(c);
    const outcomes = outcomesForCase(c.id);
    const review = reviewItemsForCase(c).slice(0, 5);
    return `Weekly Neurorehabilitation Progress Note

Case: ${c.label}
Pathway: ${c.diagnosis} · ${c.phase} · ${c.domain}
Responsible clinician: ${c.clinician || "Not specified"}
Primary functional goal: ${c.primaryGoal}
Secondary goals: ${c.secondaryGoals || "Not specified"}
Precautions / boundaries: ${c.precautions || "Not specified"}

Dose summary, current week:
- Sessions: ${stats.weekly.length}
- Active practice minutes: ${stats.activeMinutes} / ${c.weeklyMinutes}
- Scheduled minutes: ${stats.scheduledMinutes}
- Repetitions: ${stats.reps} / ${c.weeklyReps}
- Average movement quality: ${stats.quality ? stats.quality.toFixed(1) : "0.0"} / 5
- Average fatigue: ${stats.fatigue ? stats.fatigue.toFixed(1) : "0.0"} / 10
- Average pain/discomfort: ${stats.pain ? stats.pain.toFixed(1) : "0.0"} / 10
- Functional carryover: ${stats.carryoverAssessed ? `${stats.carryoverPositive}/${stats.carryoverAssessed} assessed sessions` : "Not assessed"}

Outcome measures:
${outcomes.length ? outcomes.map((o) => `- ${o.name}: baseline ${o.baseline || "—"}, current ${o.current || "—"}, target ${o.target || "—"} (${formatDate(o.date)})`).join("\n") : "- No outcome measures recorded."}

AI-Generated Review for clinician interpretation:
${review.map((item) => `- ${item.title}: ${item.interpretation} Clinician review: ${item.review}`).join("\n")}

Documentation note:
This generated note is a draft for clinician review. It summarises recorded dose, tolerance, carryover and outcomes, but does not make treatment decisions.`;
  }).join("\n\n---\n\n");
}

function exportProgressNote() {
  downloadBlob(`neurorehab-progress-note-${todayISO()}.txt`, buildProgressNote());
}

function buildFhirBundle() {
  const entries = [];

  state.cases.forEach((c) => {
    entries.push({
      resource: {
        resourceType: "Patient",
        id: c.id,
        identifier: [{ system: "https://zenkoh.github.io/neurorehab-dose-tracker/case", value: c.label }],
        note: [{ text: "Pseudonymous case label only. Avoid entering directly identifiable patient data in this prototype." }]
      }
    });

    entries.push({
      resource: {
        resourceType: "CarePlan",
        id: `careplan-${c.id}`,
        status: "active",
        intent: "plan",
        subject: { reference: `Patient/${c.id}` },
        title: `Neurorehabilitation programme: ${c.domain}`,
        description: c.primaryGoal,
        note: [
          { text: `Diagnosis/pathway: ${c.diagnosis}; phase: ${c.phase}` },
          { text: `Precautions: ${c.precautions || "None recorded"}` }
        ]
      }
    });

    entries.push({
      resource: {
        resourceType: "Goal",
        id: `goal-${c.id}`,
        lifecycleStatus: "active",
        subject: { reference: `Patient/${c.id}` },
        description: { text: c.primaryGoal },
        target: [{ detailString: c.secondaryGoals || "No secondary target recorded", dueDate: c.reviewDate || undefined }]
      }
    });
  });

  state.sessions.forEach((s) => {
    const metrics = [
      ["active-practice-minutes", "Active practice minutes", s.activeMinutes, "min"],
      ["repetitions", "Therapy repetitions", s.reps, "count"],
      ["movement-quality", "Movement quality score", s.quality, "score"],
      ["fatigue", "Fatigue rating", s.fatigue, "score"],
      ["pain", "Pain/discomfort rating", s.pain, "score"]
    ];

    metrics.forEach(([code, display, value, unit]) => {
      entries.push({
        resource: {
          resourceType: "Observation",
          id: `${code}-${s.id}`,
          status: "final",
          subject: { reference: `Patient/${s.caseId}` },
          effectiveDateTime: s.date,
          code: { text: display },
          valueQuantity: { value: Number(value), unit },
          note: [{ text: `${s.task}; ${s.setting}; ${s.assistance}; ${s.challenge}; carryover: ${s.carryover}` }]
        }
      });
    });
  });

  state.outcomes.forEach((o) => {
    entries.push({
      resource: {
        resourceType: "Observation",
        id: `outcome-${o.id}`,
        status: "final",
        subject: { reference: `Patient/${o.caseId}` },
        effectiveDateTime: o.date,
        code: { text: o.name },
        valueString: `Baseline: ${o.baseline || "—"}; current: ${o.current || "—"}; target: ${o.target || "—"}`,
        note: [{ text: `${o.direction}. ${o.note || ""}`.trim() }]
      }
    });
  });

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    meta: {
      tag: [{ system: "https://zenkoh.github.io/neurorehab-dose-tracker", code: "prototype", display: "FHIR-shaped prototype export" }]
    },
    entry: entries
  };
}

function exportFhir() {
  downloadBlob(`neurorehab-fhir-shaped-export-${todayISO()}.json`, JSON.stringify(buildFhirBundle(), null, 2), "application/json;charset=utf-8");
}

function backupJson() {
  downloadBlob(`neurorehab-dose-tracker-backup-${todayISO()}.json`, JSON.stringify(state, null, 2), "application/json;charset=utf-8");
}

function restoreJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || imported.schemaVersion !== 2 || !Array.isArray(imported.cases) || !Array.isArray(imported.sessions)) {
        alert("This does not look like a valid NeuroRehab Dose Tracker backup.");
        return;
      }
      state = {
        schemaVersion: 2,
        cases: imported.cases,
        sessions: imported.sessions,
        outcomes: Array.isArray(imported.outcomes) ? imported.outcomes : [],
        exports: Array.isArray(imported.exports) ? imported.exports : []
      };
      saveState();
      render();
    } catch {
      alert("Could not read this JSON backup.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function loadSampleData() {
  const iso = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const caseA = uid("case");
  const caseB = uid("case");

  state = {
    schemaVersion: 2,
    cases: [
      {
        id: caseA,
        label: "Case A",
        diagnosis: "Stroke",
        phase: "Outpatient",
        domain: "Upper limb",
        primaryGoal: "Improve reach, grasp and release for independent meal preparation.",
        secondaryGoals: "Reduce compensatory trunk movement; increase home-task carryover.",
        weeklyMinutes: 180,
        weeklyReps: 900,
        minimumQuality: 3,
        reviewDate: iso(6),
        clinician: "Neurorehab therapist",
        precautions: "Monitor fatigue and shoulder discomfort. Grade task if pain rises above 5/10.",
        createdAt: new Date().toISOString()
      },
      {
        id: caseB,
        label: "Case B",
        diagnosis: "Frailty / falls risk",
        phase: "Community",
        domain: "Balance",
        primaryGoal: "Improve safe sit-to-stand transfer and confidence walking indoors.",
        secondaryGoals: "Reduce fear of falling; increase caregiver-supported practice.",
        weeklyMinutes: 120,
        weeklyReps: 500,
        minimumQuality: 3,
        reviewDate: iso(-1),
        clinician: "Community rehabilitation team",
        precautions: "Use support surface for standing tasks. Review dizziness or new pain.",
        createdAt: new Date().toISOString()
      }
    ],
    sessions: [
      { id: uid("session"), caseId: caseA, date: iso(0), setting: "Clinic", task: "Reach and grasp cups", minutes: 40, activeMinutes: 32, reps: 180, quality: 3, fatigue: 5, pain: 2, assistance: "Verbal cueing", challenge: "Appropriate", specificity: "Directly linked to functional goal", carryover: "Partial", homeAdherence: "Moderate", restBreaks: 3, notes: "Better shoulder control after rest breaks.", createdAt: new Date().toISOString() },
      { id: uid("session"), caseId: caseA, date: iso(1), setting: "Home", task: "Kitchen-object transfer practice", minutes: 25, activeMinutes: 20, reps: 110, quality: 3, fatigue: 6, pain: 3, assistance: "Caregiver assist", challenge: "Appropriate", specificity: "Directly linked to functional goal", carryover: "Yes, in daily activity", homeAdherence: "High", restBreaks: 2, notes: "Used practice during snack preparation.", createdAt: new Date().toISOString() },
      { id: uid("session"), caseId: caseB, date: iso(0), setting: "Community", task: "Sit-to-stand and stepping", minutes: 30, activeMinutes: 18, reps: 75, quality: 2, fatigue: 8, pain: 1, assistance: "Manual assist", challenge: "Too difficult", specificity: "Partially linked to functional goal", carryover: "No", homeAdherence: "Low", restBreaks: 5, notes: "High fatigue; review task difficulty and confidence.", createdAt: new Date().toISOString() },
      { id: uid("session"), caseId: caseB, date: iso(3), setting: "Home", task: "Supported weight shifting", minutes: 20, activeMinutes: 12, reps: 50, quality: 2, fatigue: 8, pain: 0, assistance: "Caregiver assist", challenge: "Too difficult", specificity: "Partially linked to functional goal", carryover: "No", homeAdherence: "Low", restBreaks: 4, notes: "Caregiver reports patient avoids practice without supervision.", createdAt: new Date().toISOString() }
    ],
    outcomes: [
      { id: uid("outcome"), caseId: caseA, name: "Patient-specific functional goal: prepare a drink", baseline: "Unable without assistance", current: "Partial with setup", target: "Independent with safety", date: iso(0), direction: "Goal-specific", note: "Observed during simulated kitchen task.", createdAt: new Date().toISOString() },
      { id: uid("outcome"), caseId: caseB, name: "Timed Up and Go", baseline: "24 s", current: "22 s", target: "< 18 s", date: iso(2), direction: "Lower is better", note: "Used walking aid; close supervision.", createdAt: new Date().toISOString() }
    ],
    exports: []
  };

  saveState();
  render();
}

function clearData() {
  if (confirm("Clear all local programmes, sessions, outcomes and exports from this browser?")) {
    state = structuredClone(DEFAULT_STATE);
    saveState();
    render();
  }
}

function init() {
  $("caseForm").addEventListener("submit", saveProgramme);
  $("sessionForm").addEventListener("submit", saveSession);
  $("outcomeForm").addEventListener("submit", saveOutcome);
  $("reviewCaseFilter").addEventListener("change", render);
  $("exportCsvBtn").addEventListener("click", exportCsv);
  $("exportNoteBtn").addEventListener("click", exportProgressNote);
  $("exportFhirBtn").addEventListener("click", exportFhir);
  $("backupBtn").addEventListener("click", backupJson);
  $("restoreInput").addEventListener("change", restoreJson);
  $("loadSampleBtn").addEventListener("click", loadSampleData);
  $("clearBtn").addEventListener("click", clearData);

  $("reviewDate").value = todayISO();
  $("outcomeDate").value = todayISO();
  setSessionDefaults();
  render();
}

init();
