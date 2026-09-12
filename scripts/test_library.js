// Library.sortDreams / Library.filterDreams için birim testler.
// Projede JS test framework'u yok; Node'un yerleşik assert modülüyle
// dogrudan calistirilabilir bir test dosyasi (bkz. scripts/test_*.py deseni).
//
// Kullanim (proje kokunden):
//   node scripts/test_library.js

const assert = require("assert");
const Library = require("../static/js/library.js");

function t(name, fn) {
  fn();
  console.log("OK:", name);
}

const dreams = [
  { file: "a", saved_at: "2026-09-10T10:00:00", completion_pct: 50 },
  { file: "b", saved_at: "2026-09-12T10:00:00", completion_pct: 100 },
  { file: "c", saved_at: "2026-09-11T10:00:00", completion_pct: 0 },
];

t("date_desc varsayilan ve en yeni once", () => {
  const out = Library.sortDreams(dreams, "date_desc").map((d) => d.file);
  assert.deepStrictEqual(out, ["b", "c", "a"]);
});

t("date_asc en eski once", () => {
  const out = Library.sortDreams(dreams, "date_asc").map((d) => d.file);
  assert.deepStrictEqual(out, ["a", "c", "b"]);
});

t("pct_desc en yuksek tamamlanma once", () => {
  const out = Library.sortDreams(dreams, "pct_desc").map((d) => d.file);
  assert.deepStrictEqual(out, ["b", "a", "c"]);
});

t("pct_asc en dusuk tamamlanma once", () => {
  const out = Library.sortDreams(dreams, "pct_asc").map((d) => d.file);
  assert.deepStrictEqual(out, ["c", "a", "b"]);
});

t("filterDreams onlyIncomplete yuzde 100'u disliyor", () => {
  const out = Library.filterDreams(dreams, { onlyIncomplete: true }).map((d) => d.file);
  assert.deepStrictEqual(out, ["a", "c"]);
});

t("filterDreams secenek yoksa kopyasini degismeden dondurur", () => {
  const out = Library.filterDreams(dreams);
  assert.strictEqual(out.length, 3);
  assert.notStrictEqual(out, dreams);
});

t("sortDreams girdi dizisini mutasyona ugratmaz", () => {
  const copy = dreams.slice();
  Library.sortDreams(dreams, "pct_asc");
  assert.deepStrictEqual(dreams, copy);
});

console.log("\nTum testler gecti.");
