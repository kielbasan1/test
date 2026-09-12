// Rüya Kütüphanesi — geçmiş rüya özetlerini sıralama/filtreleme.
//
// Saf fonksiyonlar: DOM'a hiç dokunmaz, backend'den gelen dream özet
// listesini (file, saved_at, dream_text, symbol_count, completion_pct)
// alır, sıralı/filtrelenmiş yeni bir dizi döner. main.js render için
// kullanır; Node'da (scripts/test_library.js) doğrudan test edilir.

const Library = (() => {
  function sortDreams(dreams, sortKey) {
    const list = dreams.slice();
    switch (sortKey) {
      case "date_asc":
        list.sort((a, b) => new Date(a.saved_at) - new Date(b.saved_at));
        break;
      case "pct_desc":
        list.sort((a, b) => (b.completion_pct || 0) - (a.completion_pct || 0));
        break;
      case "pct_asc":
        list.sort((a, b) => (a.completion_pct || 0) - (b.completion_pct || 0));
        break;
      case "date_desc":
      default:
        list.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));
    }
    return list;
  }

  function filterDreams(dreams, { onlyIncomplete } = {}) {
    if (!onlyIncomplete) return dreams.slice();
    return dreams.filter((d) => (d.completion_pct || 0) < 100);
  }

  return { sortDreams, filterDreams };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Library;
}
