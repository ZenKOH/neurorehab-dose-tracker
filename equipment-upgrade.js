(function () {
  "use strict";

  const APP_KEY = "neurorehabDoseTracker.v5";
  const $ = id => document.getElementById(id);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const tr = value => globalThis.i18n?.translateText(String(value ?? "")) ?? String(value ?? "");
  const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const uid = prefix => globalThis.crypto?.randomUUID ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const DEFAULT_EQUIPMENT = [
    { id: "eq-handvivante", name: "HandVivante™ MirrorHand", category: "Upper limb", notes: "Robotic mirror hand therapy / bilateral hand practice" },
    { id: "eq-gaitvivante", name: "GaitVivante™", category: "Gait", notes: "Gait training and stepping practice" },
    { id: "eq-elevovivante", name: "ElevoVivante™", category: "Lower limb / FES", notes: "Assisted lower-limb activation and upright practice" },
    { id: "eq-revitavivante", name: "RevitaVivante™", category: "FES cycling", notes: "FES cycling and cardiometabolic conditioning" },
    { id: "eq-armmotus", name: "ArmMotus™", category: "Upper limb", notes: "Arm task practice and movement feedback" },
    { id: "eq-wristmotus", name: "WristMotus™", category: "Upper limb", notes: "Wrist and distal upper-limb practice" },
    { id: "eq-balancevivante", name: "BalanceVivante™", category: "Balance", notes: "Balance training and postural control" },
    { id: "eq-exovivante", name: "ExoVivante™", category: "Exoskeleton", notes: "Assisted mobility / exoskeleton-supported practice" },
    { id: "eq-none", name: "Conventional therapy only", category: "Conventional", notes: "No device used in this session" }
  ];

  const equipmentForDomain = domain => ({
    "Upper limb": ["eq-handvivante"],
    "Gait": ["eq-gaitvivante"],
    "Balance": ["eq-balancevivante"],
    "Functional task practice": ["eq-exovivante"],
    "ADL / participation": ["eq-handvivante"],
    "Mixed programme": ["eq-handvivante", "eq-gaitvivante"]
  }[domain] || ["eq-none"]);

  function status(message) {
    const el = $("appStatus");
    if (!el) return;
    el.textContent = tr(message);
    clearTimeout(status.timer);
    status.timer = setTimeout(() => { el.textContent = ""; }, 5000);
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(APP_KEY));
      if (parsed && Array.isArray(parsed.cases) && Array.isArray(parsed.sessions)) return parsed;
    } catch { /* ignore */ }
    return null;
  }

  function writeState(state) {
    localStorage.setItem(APP_KEY, JSON.stringify(state));
  }

  function equipmentNameMap(state) {
    return new Map((state?.equipment || DEFAULT_EQUIPMENT).map(item => [item.id, item.name]));
  }

  function equipmentNames(state, ids) {
    const names = equipmentNameMap(state);
    return (ids || []).map(id => names.get(id)).filter(Boolean).join(", ") || "Conventional therapy only";
  }

  function hydrateEquipment(force = false) {
    const state = readState();
    if (!state) return null;
    let changed = false;
    if (!Array.isArray(state.equipment) || force) {
      const existing = new Map((state.equipment || []).map(item => [item.id, item]));
      state.equipment = DEFAULT_EQUIPMENT.map(item => existing.get(item.id) || item).concat((state.equipment || []).filter(item => !DEFAULT_EQUIPMENT.some(base => base.id === item.id)));
      changed = true;
    }
    const valid = new Set(state.equipment.map(item => item.id));
    for (const session of state.sessions) {
      if (!Array.isArray(session.equipment) || !session.equipment.some(id => valid.has(id))) {
        const c = state.cases.find(item => item.id === session.caseId);
        session.equipment = session.assistance === "Robotic assist" ? equipmentForDomain(c?.domain) : ["eq-none"];
        session.equipmentIntent = session.equipment.some(id => id !== "eq-none") ? "Task-specific practice" : "Conventional therapy";
        session.equipmentDose = session.equipment.some(id => id !== "eq-none") ? "Device-supported practice; parameters to be reviewed" : "";
        changed = true;
      }
    }
    if (changed) writeState(state);
    return state;
  }

  function repairTabs() {
    const tabs = $$(".tab-button[data-tab]");
    const panels = $$(".tab-panel");
    if (!tabs.length || !panels.length) return;
    function show(tab) {
      const valid = panels.some(panel => panel.id === tab) ? tab : "overview";
      tabs.forEach(button => {
        const active = button.dataset.tab === valid;
        button.classList.toggle("active", active);
        button.setAttribute("aria-current", active ? "page" : "false");
      });
      panels.forEach(panel => {
        const active = panel.id === valid;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      });
    }
    tabs.forEach(button => {
      button.setAttribute("aria-controls", button.dataset.tab || "");
      button.addEventListener("click", event => {
        event.preventDefault();
        const next = button.dataset.tab || "overview";
        if (location.hash !== `#${next}`) location.hash = next;
        show(next);
      });
    });
    window.addEventListener("hashchange", () => show(location.hash.replace("#", "")));
    show(location.hash.replace("#", "") || "overview");
  }

  function injectEquipmentSection() {
    const form = $("sessionForm");
    if (!form || $("equipmentUsed")) return;
    const taskLabel = $("task")?.closest("label") || form.querySelector("label");
    const section = document.createElement("fieldset");
    section.className = "equipment-section";
    section.innerHTML = `
      <legend>${tr("Equipment used in this session")}</legend>
      <p class="small-note">${tr("Select device-supported practice, or add a local custom equipment option.")}</p>
      <label>${tr("Equipment")} <select id="equipmentUsed" multiple size="6"></select></label>
      <div class="grid-2">
        <label>${tr("Equipment intent")} <select id="equipmentIntent"><option>Task-specific practice</option><option>Robotic assist</option><option>Gait training</option><option>Balance training</option><option>FES cycling</option><option>Motor priming</option><option>Home practice</option><option>Assessment / familiarisation</option></select></label>
        <label>${tr("Device dose / parameters")} <input id="equipmentDose" type="text" placeholder="e.g. 15 min robotic assist; FES level 3; gait mode A" /></label>
      </div>
      <div class="grid-2">
        <label>${tr("Add custom equipment")} <input id="customEquipment" type="text" placeholder="e.g. HandVivante™ home kit" /></label>
        <label>${tr("Category")} <select id="customEquipmentCategory"><option>Upper limb</option><option>Gait</option><option>Balance</option><option>FES cycling</option><option>Exoskeleton</option><option>Conventional</option><option>Other</option></select></label>
      </div>
      <button id="addEquipmentBtn" type="button" class="secondary">${tr("Add equipment to list")}</button>`;
    taskLabel?.after(section);
    const sidePanel = document.createElement("section");
    sidePanel.className = "panel equipment-library-panel";
    sidePanel.innerHTML = `<div class="section-heading"><h2>${tr("Equipment library")}</h2><p>${tr("Default equipment includes HandVivante™, GaitVivante™, ElevoVivante™ and RevitaVivante™. Custom entries are stored locally.")}</p></div><div id="equipmentList" class="equipment-grid"></div>`;
    const sessionsList = $("sessionsList")?.closest(".panel");
    sessionsList?.before(sidePanel);
    $("addEquipmentBtn")?.addEventListener("click", () => addCustomEquipment(true));
  }

  function renderEquipmentOptions() {
    const state = hydrateEquipment();
    const select = $("equipmentUsed");
    if (!state || !select) return;
    const selected = new Set(Array.from(select.selectedOptions).map(option => option.value));
    select.innerHTML = state.equipment.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.category)}</option>`).join("");
    Array.from(select.options).forEach(option => { option.selected = selected.has(option.value); });
    if (!Array.from(select.selectedOptions).length && state.equipment.some(item => item.id === "eq-none")) select.value = "eq-none";
  }

  function renderEquipmentLibrary() {
    const state = hydrateEquipment();
    const target = $("equipmentList");
    if (!state || !target) return;
    const usage = new Map();
    for (const session of state.sessions) for (const id of session.equipment || []) usage.set(id, (usage.get(id) || 0) + 1);
    target.innerHTML = state.equipment.map(item => `<article class="equipment-chip"><strong>${esc(item.name)}</strong><span>${esc(item.category)}</span><small>${esc(item.notes || "")}</small><em>${usage.get(item.id) || 0} ${tr("session(s)")}</em></article>`).join("");
  }

  function addCustomEquipment(selectAfter) {
    const state = hydrateEquipment() || { equipment: DEFAULT_EQUIPMENT, sessions: [], cases: [] };
    const input = $("customEquipment");
    const name = input?.value.trim();
    if (!name) return null;
    const existing = state.equipment.find(item => item.name.toLowerCase() === name.toLowerCase());
    const record = existing || { id: uid("eq"), name, category: $("customEquipmentCategory")?.value || "Other", notes: "Custom equipment added locally" };
    if (!existing) state.equipment.push(record);
    writeState(state);
    if (input) input.value = "";
    renderEquipmentOptions();
    renderEquipmentLibrary();
    if (selectAfter && $("equipmentUsed")) Array.from($("equipmentUsed").options).forEach(option => { option.selected = option.value === record.id; });
    status(`Equipment added: ${record.name}`);
    return record.id;
  }

  function selectedEquipmentIds() {
    const select = $("equipmentUsed");
    const values = select ? Array.from(select.selectedOptions).map(option => option.value) : [];
    return values.length ? values : ["eq-none"];
  }

  function appendEquipmentToLatestSession() {
    const customId = $("customEquipment")?.value.trim() ? addCustomEquipment(false) : null;
    const selected = selectedEquipmentIds().filter(id => id !== "eq-none");
    const equipment = customId ? [...new Set([...selected, customId])] : selectedEquipmentIds();
    setTimeout(() => {
      const state = hydrateEquipment();
      if (!state || !state.sessions.length) return;
      const newest = state.sessions[0];
      newest.equipment = equipment.length ? equipment : ["eq-none"];
      newest.equipmentIntent = $("equipmentIntent")?.value || "Task-specific practice";
      newest.equipmentDose = $("equipmentDose")?.value.trim() || "";
      writeState(state);
      renderEquipmentOptions();
      renderEquipmentLibrary();
      status("Session saved with equipment details.");
    }, 0);
  }

  function patchSessionForm() {
    const form = $("sessionForm");
    if (!form) return;
    form.addEventListener("submit", appendEquipmentToLatestSession);
  }

  function forceEquipmentAfterSampleLoad() {
    $("loadSampleBtn")?.addEventListener("click", () => setTimeout(() => {
      hydrateEquipment(true);
      renderEquipmentOptions();
      renderEquipmentLibrary();
    }, 0));
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    status(`${filename} exported.`);
  }

  function patchExports() {
    const exportCsv = event => { event.preventDefault(); event.stopImmediatePropagation(); const state = hydrateEquipment(); if (state) download("neurorehab-sessions.csv", makeCsv(state), "text/csv"); };
    const exportNote = event => { event.preventDefault(); event.stopImmediatePropagation(); const state = hydrateEquipment(); if (state) download("neurorehab-progress-note.txt", makeNote(state), "text/plain"); };
    const exportFhir = event => { event.preventDefault(); event.stopImmediatePropagation(); const state = hydrateEquipment(); if (state) download("neurorehab-fhir-prototype.json", JSON.stringify(makeFhir(state), null, 2), "application/json"); };
    const backup = event => { event.preventDefault(); event.stopImmediatePropagation(); const state = hydrateEquipment(); if (state) download("neurorehab-dose-tracker-backup.json", JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2), "application/json"); };
    $("exportCsvBtn")?.addEventListener("click", exportCsv, true);
    $("exportNoteBtn")?.addEventListener("click", exportNote, true);
    $("exportFhirBtn")?.addEventListener("click", exportFhir, true);
    $("backupBtn")?.addEventListener("click", backup, true);
  }

  function makeCsv(state) {
    const headers = ["case_label", "date", "setting", "task", "scheduled_minutes", "active_minutes", "repetitions", "quality", "fatigue", "pain", "assistance", "challenge", "specificity", "carryover", "home_adherence", "rest_breaks", "equipment", "equipment_intent", "equipment_dose", "notes"];
    const rows = state.sessions.map(session => {
      const c = state.cases.find(item => item.id === session.caseId);
      return [c?.label || "Unknown case", session.date, session.setting, session.task, session.minutes, session.activeMinutes, session.reps, session.quality, session.fatigue, session.pain, session.assistance, session.challenge, session.specificity, session.carryover, session.homeAdherence, session.restBreaks, equipmentNames(state, session.equipment), session.equipmentIntent || "", session.equipmentDose || "", session.notes || ""];
    });
    return [headers, ...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  }

  function makeNote(state) {
    return state.cases.map(c => {
      const sessions = state.sessions.filter(item => item.caseId === c.id);
      const active = sessions.reduce((sum, item) => sum + Number(item.activeMinutes || 0), 0);
      const reps = sessions.reduce((sum, item) => sum + Number(item.reps || 0), 0);
      const equipmentLines = sessions.slice(0, 8).map(session => `- ${session.date || "No date"}: ${equipmentNames(state, session.equipment)}${session.equipmentIntent ? ` (${session.equipmentIntent})` : ""}${session.equipmentDose ? ` — ${session.equipmentDose}` : ""}`).join("\n") || "- No session equipment recorded.";
      return `Weekly Neurorehabilitation Progress Note\n\nCase: ${c.label}\nPathway: ${c.diagnosis} · ${c.phase} · ${c.domain}\nPrimary functional goal: ${c.primaryGoal}\n\nDose summary:\n- Sessions: ${sessions.length}\n- Active practice minutes: ${active}\n- Repetitions: ${reps}\n\nEquipment used:\n${equipmentLines}\n\nDocumentation note:\nThis generated note is a draft for clinician review and does not make treatment decisions.`;
    }).join("\n\n---\n\n") || "No programme data available.";
  }

  function makeFhir(state) {
    const language = globalThis.i18n?.language || "en";
    const entry = [];
    state.equipment.forEach(item => entry.push({ resource: { resourceType: "Device", id: item.id, language, deviceName: [{ name: item.name, type: "user-friendly-name" }], type: { text: item.category }, note: item.notes ? [{ text: item.notes }] : [] } }));
    state.cases.forEach(c => entry.push({ resource: { resourceType: "CarePlan", id: c.id, language, status: "active", intent: "plan", title: c.label, description: c.primaryGoal, category: [{ text: c.domain }] } }));
    state.sessions.forEach(session => entry.push({ resource: { resourceType: "Procedure", id: session.id, language, status: "completed", subject: { reference: `CarePlan/${session.caseId}` }, performedDateTime: session.date, code: { text: session.task }, usedReference: (session.equipment || []).filter(id => id !== "eq-none").map(id => ({ reference: `Device/${id}`, display: equipmentNameMap(state).get(id) || id })), note: [{ text: `Active ${session.activeMinutes}/${session.minutes} min; reps ${session.reps}; quality ${session.quality}/5; fatigue ${session.fatigue}/10; pain ${session.pain}/10; equipment intent ${session.equipmentIntent || "not specified"}; ${session.equipmentDose || ""}` }] } }));
    return { resourceType: "Bundle", type: "collection", language, timestamp: new Date().toISOString(), entry };
  }

  document.addEventListener("DOMContentLoaded", () => {
    repairTabs();
    injectEquipmentSection();
    hydrateEquipment();
    renderEquipmentOptions();
    renderEquipmentLibrary();
    patchSessionForm();
    forceEquipmentAfterSampleLoad();
    patchExports();
    window.addEventListener("languagechange", () => setTimeout(() => {
      injectEquipmentSection(); renderEquipmentOptions(); renderEquipmentLibrary();
    }, 0));
    status("Interface upgraded: tabs, exports and therapy-session equipment tracking are active.");
  });
})();
