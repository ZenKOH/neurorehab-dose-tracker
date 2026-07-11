const STORAGE_KEY = "neurorehabDoseTracker.sessions.v1";
const TARGET_KEY = "neurorehabDoseTracker.targets.v1";

const $ = (id) => document.getElementById(id);

let sessions = loadSessions();
let targets = loadTargets();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function loadTargets() {
  try {
    return JSON.parse(localStorage.getItem(TARGET_KEY)) || { minutes: 180, reps: 1000, quality: 3 };
  } catch {
    return { minutes: 180, reps: 1000, quality: 3 };
  }
}

function saveTargets() {
  localStorage.setItem(TARGET_KEY, JSON.stringify(targets));
}

function startOfWeek(date) {
  const d = new Date(date + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as week start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isThisWeek(dateString) {
  const start = startOfWeek(todayISO());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const date = new Date(dateString + "T12:00:00");
  return date >= start && date < end;
}

function pct(value, target) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function formatDate(dateString) {
  return new Date(dateString + "T12:00:00").toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric"
  });
}

function render() {
  $("targetMinutes").value = targets.minutes;
  $("targetReps").value = targets.reps;
  $("targetQuality").value = targets.quality;

  const weekly = sessions.filter((s) => isThisWeek(s.date));
  const totalMinutes = weekly.reduce((sum, s) => sum + Number(s.minutes || 0), 0);
  const totalReps = weekly.reduce((sum, s) => sum + Number(s.reps || 0), 0);
  const avgQuality = weekly.length
    ? weekly.reduce((sum, s) => sum + Number(s.quality || 0), 0) / weekly.length
    : 0;

  $("sessionsThisWeek").textContent = weekly.length;
  $("minutesThisWeek").textContent = totalMinutes;
  $("repsThisWeek").textContent = totalReps;
  $("avgQuality").textContent = avgQuality.toFixed(1);

  const minutesPct = pct(totalMinutes, targets.minutes);
  const repsPct = pct(totalReps, targets.reps);
  $("minutesBar").style.width = `${minutesPct}%`;
  $("repsBar").style.width = `${repsPct}%`;
  $("minutesPct").textContent = `${minutesPct}%`;
  $("repsPct").textContent = `${repsPct}%`;

  renderInsights(weekly, totalMinutes, totalReps, avgQuality);
  renderSessions();
}

function renderInsights(weekly, totalMinutes, totalReps, avgQuality) {
  const insights = [];
  const newest = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0];

  if (!sessions.length) {
    insights.push({ type: "warning", text: "No sessions recorded yet. Add one session to start seeing dose and quality patterns." });
  } else {
    const daysSinceLast = newest
      ? Math.floor((new Date(todayISO()) - new Date(newest.date)) / (1000 * 60 * 60 * 24))
      : 0;

    if (daysSinceLast >= 3) {
      insights.push({ type: "warning", text: `No session has been logged for ${daysSinceLast} days. Consider checking whether home practice, transport, motivation, fatigue, or scheduling is the barrier.` });
    }

    if (totalMinutes < targets.minutes * 0.5) {
      insights.push({ type: "warning", text: "Weekly therapy minutes are still below half of target. The key question is not motivation alone; it may be whether the care pathway has made practice easy enough to repeat." });
    }

    if (totalReps < targets.reps * 0.5) {
      insights.push({ type: "warning", text: "Weekly repetitions are below half of target. Consider whether the task can be simplified, split into shorter bouts, or linked to daily routines." });
    }

    const highFatigueLowQuality = weekly.filter((s) => Number(s.fatigue) >= 8 && Number(s.quality) <= 2);
    if (highFatigueLowQuality.length) {
      insights.push({ type: "warning", text: "High fatigue and low movement quality were recorded in at least one session. This is a signal to review task difficulty, rest intervals, safety, and compensation patterns with a clinician." });
    }

    const carryoverCount = weekly.filter((s) => s.carryover === "Yes, in daily activity" || s.carryover === "Partial").length;
    if (weekly.length >= 2 && carryoverCount === 0) {
      insights.push({ type: "warning", text: "No carryover has been observed this week. The programme may be producing session activity without enough transfer into daily function." });
    }

    if (weekly.length && avgQuality >= targets.quality && totalMinutes >= targets.minutes && totalReps >= targets.reps) {
      insights.push({ type: "good", text: "Dose, repetitions, and quality are all meeting the current weekly targets. The next useful question is whether gains are transferring into real-world activity." });
    } else if (weekly.length) {
      insights.push({ type: "good", text: "Data is being collected. That already changes the conversation: dose, quality, fatigue, and carryover can now be reviewed together rather than guessed from memory." });
    }
  }

  $("insights").innerHTML = insights.map((item) =>
    `<div class="insight ${item.type}">${escapeHtml(item.text)}</div>`
  ).join("");
}

function renderSessions() {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    $("sessionsList").innerHTML = `<p class="empty">No sessions saved yet.</p>`;
    return;
  }

  $("sessionsList").innerHTML = sorted.map((s) => `
    <article class="session-item">
      <div class="session-top">
        <div>
          <div class="session-title">${escapeHtml(s.task)} · ${escapeHtml(s.focus)}</div>
          <div class="session-meta">
            ${formatDate(s.date)} · ${escapeHtml(s.caseLabel || "No case label")}<br />
            ${s.minutes} min · ${s.reps} reps · quality ${s.quality}/5 · fatigue ${s.fatigue}/10 · carryover: ${escapeHtml(s.carryover)}
          </div>
        </div>
        <button class="delete-session danger" data-id="${s.id}">Delete</button>
      </div>
      ${s.notes ? `<p class="session-notes">${escapeHtml(s.notes)}</p>` : ""}
    </article>
  `).join("");

  document.querySelectorAll(".delete-session").forEach((button) => {
    button.addEventListener("click", () => {
      sessions = sessions.filter((s) => s.id !== button.dataset.id);
      saveSessions();
      render();
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toCsv(rows) {
  const headers = ["date", "caseLabel", "focus", "task", "minutes", "reps", "quality", "fatigue", "carryover", "notes"];
  const csvRows = [headers.join(",")];
  for (const row of rows) {
    csvRows.push(headers.map((header) => {
      const value = row[header] ?? "";
      return `"${String(value).replaceAll('"', '""')}"`;
    }).join(","));
  }
  return csvRows.join("\n");
}

function downloadCsv() {
  const csv = toCsv(sessions);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `neurorehab-dose-tracker-${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function loadSampleData() {
  const base = new Date();
  const iso = (daysAgo) => {
    const d = new Date(base);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  sessions = [
    { id: crypto.randomUUID(), date: iso(0), caseLabel: "Case A", focus: "Upper limb", task: "Reach and grasp cups", minutes: 35, reps: 180, quality: 3, fatigue: 5, carryover: "Partial", notes: "Better shoulder control after rest breaks." },
    { id: crypto.randomUUID(), date: iso(1), caseLabel: "Case A", focus: "Gait", task: "Sit-to-stand and stepping", minutes: 30, reps: 120, quality: 4, fatigue: 6, carryover: "Yes, in daily activity", notes: "Used practice during transfers at home." },
    { id: crypto.randomUUID(), date: iso(3), caseLabel: "Case A", focus: "Balance", task: "Weight shifting", minutes: 25, reps: 90, quality: 2, fatigue: 8, carryover: "No", notes: "High fatigue; review task difficulty." }
  ];
  saveSessions();
  render();
}

$("date").value = todayISO();

$("sessionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const session = {
    id: crypto.randomUUID(),
    date: $("date").value,
    caseLabel: $("caseLabel").value.trim(),
    focus: $("focus").value,
    task: $("task").value.trim(),
    minutes: Number($("minutes").value),
    reps: Number($("reps").value),
    quality: Number($("quality").value),
    fatigue: Number($("fatigue").value),
    carryover: $("carryover").value,
    notes: $("notes").value.trim()
  };
  sessions.push(session);
  saveSessions();
  event.target.reset();
  $("date").value = todayISO();
  $("minutes").value = 30;
  $("reps").value = 100;
  $("quality").value = 3;
  $("fatigue").value = 4;
  render();
});

$("saveTargetsBtn").addEventListener("click", () => {
  targets = {
    minutes: Number($("targetMinutes").value),
    reps: Number($("targetReps").value),
    quality: Number($("targetQuality").value)
  };
  saveTargets();
  render();
});

$("exportCsvBtn").addEventListener("click", downloadCsv);
$("loadSampleBtn").addEventListener("click", loadSampleData);
$("clearBtn").addEventListener("click", () => {
  if (confirm("Clear all saved sessions from this browser?")) {
    sessions = [];
    saveSessions();
    render();
  }
});

render();
