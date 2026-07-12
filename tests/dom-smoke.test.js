const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");

function launch() {
  const dom = new JSDOM(fs.readFileSync(path.join(root, "index.html"), "utf8"), {
    runScripts: "outside-only",
    url: "https://example.test/neurorehab-dose-tracker/"
  });
  dom.window.scrollTo = () => {};
  dom.window.eval(fs.readFileSync(path.join(root, "i18n.js"), "utf8"));
  dom.window.eval(fs.readFileSync(path.join(root, "app-v4.js"), "utf8"));
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true }));
  return dom;
}

test("language menu switches the rendered dashboard without changing clinical option values", () => {
  const dom = launch();
  const { document } = dom.window;

  document.getElementById("languageButton").click();
  assert.equal(document.getElementById("languageMenu").hidden, false);
  document.querySelector('[data-language="es"]').click();

  assert.equal(document.documentElement.lang, "es");
  assert.equal(document.getElementById("languageButtonLabel").textContent, "Español");
  assert.equal(document.querySelector(".tab-button").textContent.trim(), "Resumen");

  const stroke = [...document.querySelectorAll("#diagnosis option")].find(option => option.value === "Stroke");
  assert.ok(stroke, "stable English clinical value remains available");
  assert.equal(stroke.textContent, "Ictus");
  dom.window.close();
});

test("dynamic clinical content and the page title localise in Chinese", () => {
  const dom = launch();
  const { document } = dom.window;
  document.getElementById("languageButton").click();
  document.querySelector('[data-language="zh-Hans"]').click();

  assert.equal(document.title, "神经康复剂量追踪器");
  assert.equal(document.querySelector("#overview h2").textContent.trim(), "康复指挥中心");
  assert.match(document.getElementById("minutesTargetLabel").textContent, /^目标：/);
  assert.match(document.getElementById("insights").textContent, /临床复核/);
  dom.window.close();
});
