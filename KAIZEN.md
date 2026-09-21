# Kaizen — UI backlog

Gemba taraması: `static/css/style.css`, `static/js/main.js` (+i18n/symbolmap/wheel), `templates/*.html`.
Kapsam: **UI tarafı**, kod-seviyesi muda/mura/muri (görsel yön/estetik değişikliği yok — mevcut
Gece Rasathanesi temasına hiç dokunulmadı, sadece tutarlılık/erişilebilirlik).

## Backlog (etkiye göre sıralı)

| # | Bulgu | Tür | Durum |
|---|---|---|---|
| 1 | `history-card` (`<li>`, kütüphane listesi) tıklanabilir ama klavyeyle erişilemiyor — aynı dosyada iki farklı yerde (satır ~623, ~885) zaten kurulu olan `role="button"+tabindex+keydown` kalıbı burada yok. | mura (tutarsız uygulama) | round 1 |
| 2 | ~~`style.css`'te hex renk/token tekrarı~~ — **Check'te elendi:** taradığımda ham hex kullanımının tamamı `:root` tanımlarının kendisiydi, dosyanın geri kalanı zaten %100 `var()` kullanıyor. Yerine: `.map-qa-card` — hiçbir JS/HTML'de referansı olmayan ölü CSS selector'ü (bir animasyon grubu listesinde). | muda (ölü kod) | round 2 |
| 3 | 3 input sadece `placeholder`e güveniyor, kalıcı label/aria-label yok: `manual-symbol-input`, `assoc-input`, login şifre alanı. (Check'te düzeltildi: `dream-title` ve checkbox'lar zaten `<label>` ile sarılıymış, ilk taramada yanlış işaretlemişim.) | mura (a11y) | round 3 |
| 4 | `templates/index.html`'de 49 `<button>`'ın 24'ünde `type` yok (HTML varsayılanı `submit`) — dosyadaki diğer yarısı zaten `type="button"` yazıyor, tutarsız. Şu an tek `<form>` (logout) bunlardan etkilenmiyor ama örtük varsayılana güvenmek kırılgan. | mura | round 4 |
| 5 | `symbol-rename-btn` CSS sınıfı 11 yerde (main.js 6, style.css 5) rename dışı ikon-buton için de kullanılıyor (silme, indirme, ritüel) — yanıltıcı isim. | mura (adlandırma) | round 5 |

**Ertelenen (bu 5 turun dışında bırakıldı):** ~8 salt bilgilendirici `window.alert(...)` çağrısı
çıplak tarayıcı dialoguyla açılıyor; proje bir yerde (sembol silme) zaten toast+undo kalıbı
kurmuş ama burada uygulanmamış (mura). Bunu otomatik yapmadım çünkü kapsamı "tek küçük
değişiklik"in ötesine geçiyor — yeni bir genel toast bileşeni + görünüm demek, bu da bir
tasarım kararı (Kaan'ın referans bekleme tercihi). Ayrıca istersen ayrı ele alırız.

## Log

- **Round 1:** `history-card` li'ye `role="button"` + `tabindex="0"` + Enter/Space keydown eklendi
  (satır ~2808, ~2906 civarı, `main.js`), 885/919'daki kalıp birebir mirror edildi. `node --check`
  geçti. Commit yok (demo branch, onay bekliyor).
- **Round 2:** Plan aşamasında "hardcoded hex → token" hedeflendi, ama Check'te (gerçek koda
  tekrar bakınca) bunun geçersiz olduğu çıktı — tüm hex kullanımı zaten sadece `:root` tanımları.
  Onun yerine gerçek bir muda bulundu: `.map-qa-card` selector'ü hiçbir yerde kullanılmıyor
  (animasyon grubu listesinden çıkarıldı, `style.css` satır ~192). Sıfır görsel etki.
- **Round 3:** Check'te kapsam daraldı — `dream-title` ve checkboxlar zaten `<label>` ile
  sarılıydı, gerçek boşluk sadece `manual-symbol-input`, `assoc-input`, login şifre alanıydı.
  Üçüne de `data-i18n-aria` eklendi — projenin kendi i18n sistemi (`applyStaticDom()`,
  `i18n.js:554`) zaten `data-i18n-aria` işliyor, mevcut placeholder anahtarları yeniden
  kullanıldı (yeni çeviri metni gerekmedi). `login.html` da `i18n.js`'i yüklüyor, `init()`
  DOMContentLoaded'da çalışıyor — doğrulandı.
- **Round 4:** `templates/index.html`'de type'sız 24 `<button>`'a `type="button"` eklendi (tek
  `<form>` olan logout butonu zaten `type="submit"`, dokunulmadı). Mekanik, sıfır görsel/davranış
  farkı bugün — ileriye dönük kırılganlık kapatıldı.
- **Round 5:** `symbol-rename-btn` → `icon-btn` (11 yer, main.js 6 + style.css 5). `node --check`
  geçti, eski isimden hiç iz kalmadı. Sadece isim, davranış/görünüm aynı.

## Sonuç (demo, main'e alınmadı)

5 tur bitti — `kaizen-ui-demo` branch'inde, commit edilmeden duruyor. Değişen dosyalar:
`static/js/main.js`, `static/css/style.css`, `templates/index.html`, `templates/login.html`.
Hepsi görsel yönü (Gece Rasathanesi temasına) dokunmuyor — sadece klavye erişilebilirliği, ölü
kod, tutarlılık. Kaan tarayıcıda görüp onaylarsa `main`'e alınır.
