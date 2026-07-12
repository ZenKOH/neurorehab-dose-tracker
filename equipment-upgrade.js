(function () {
  "use strict";

  const APP_KEY = "neurorehabDoseTracker.v5";
  const LEGACY_ID_MAP = new Map([
    ["eq-handvivante", "equipment-handvivante"],
    ["eq-gaitvivante", "equipment-gaitvivante"],
    ["eq-elevovivante", "equipment-elevovivante"],
    ["eq-revitavivante", "equipment-revitavivante"],
    ["eq-none", ""],
  ]);

  function readState() {
    try {
      const state = JSON.parse(localStorage.getItem(APP_KEY));
      return state && Array.isArray(state.sessions) ? state : null;
    } catch {
      return null;
    }
  }

  function writeState(state) {
    try { localStorage.setItem(APP_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }

  function migrateLegacyEquipmentFields() {
    const state = readState();
    if (!state) return;
    let changed = false;
    for (const session of state.sessions) {
      if (Array.isArray(session.equipmentIds) && session.equipmentIds.length) continue;
      if (!Array.isArray(session.equipment) || !session.equipment.length) continue;
      const ids = session.equipment
        .map(id => LEGACY_ID_MAP.has(id) ? LEGACY_ID_MAP.get(id) : id)
        .filter(Boolean);
      if (ids.length) {
        session.equipmentIds = [...new Set(ids)];
        changed = true;
      }
      delete session.equipment;
    }
    if (changed) writeState(state);
  }

  function repairTabButtons() {
    const buttons = Array.from(document.querySelectorAll(".tab-button[data-tab]"));
    if (!buttons.length) return;
    buttons.forEach(button => {
      button.type = "button";
      button.setAttribute("aria-controls", button.dataset.tab);
    });
  }

  function surfaceEquipmentHash() {
    if (location.hash === "#equipment") {
      document.getElementById("equipment")?.scrollIntoView({ block: "start" });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    migrateLegacyEquipmentFields();
    repairTabButtons();
    surfaceEquipmentHash();
    window.addEventListener("hashchange", surfaceEquipmentHash);
  });
})();
