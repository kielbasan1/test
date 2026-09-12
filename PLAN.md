---
title: Sembol Çarkı — Geliştirme Planı
created: 2026-09-07
modified: 2026-09-07
type: plan
status: active
tags: [jung, ruya, proje]
---

# Sembol Çarkı — Geliştirme Planı

## Şu anki durum

Akış: rüya metni → Gemini sembol çıkarımı → her sembol için çağrışım çarkı + 4 soru
→ her sembol için web amplifikasyonu (Tavily, yedek DuckDuckGo) → Gemini sentezi →
JSON olarak `ruyalar/` altına kayıt.

Johnson'ın dört adımına karşılık: Adım 1 (çağrışım) ✅, Adım 2-3 (dinamik + yorum) ✅,
**Adım 4 (ritüel) eksik** — yorumun içinde bir cümle olarak öneriliyor ama takibi yok.

## Faz 1 — Yöntemin eksik parçaları

En yüksek değer / en düşük maliyet. Yeni sentez promptu bu verileri kullanmaya hazır,
şu an olmadıkları için model onları rüya metninden tahmin etmeye çalışıyor.

**1.1 Rüya düzeyi sorular — yapıldı (2026-09-12).** Uygulama daha önce sadece sembol
düzeyinde soru soruyordu. Jungiyen analizin en çok bilgi taşıyan üç verisi rüyanın
bütününe ait, `step-dream`'e (Kaan'ın son haliyle) üç opsiyonel alan olarak eklendi:

- **`dream_attitude`** — *Rüyadaki genel tutumun neydi?* Rüya-ego'nun tutumu
  (katılan/izleyen, kaçan/duran). Uyanık ego tutumunun doğrudan aynası; çoğu zaman
  rüyanın en belirleyici tek detayı.
- **`dream_emotion`** — *Rüyada ne hissettin, uyandığında hangi duygu kaldı?*
  Duygusal ton. Jung'a göre anlamın en güvenilir göstergesi; asıl bilgi, hissedilen
  duygunun "normalde" hissedilecek olandan sapmasında.
- **`dream_arc`** — *Rüya nasıl başladı, nasıl bitti?* Tek alanda birleşik (Kaan'ın
  tercihi — az sürtünme). Çözülüş var mı yok mu burada görünür; çözülüşsüz biten
  rüya, bilinçdışının henüz çözüm sunmadığı anlamına gelir ve başlı başına bir
  bulgudur.

Dokunulan yerler: `templates/index.html` (3 opsiyonel textarea), `static/js/main.js`
(state + el referansları, `buildRecord` — hem kayıt hem "Yorumu Genişlet" payload'ı
tek bu fonksiyondan geçtiği için tek noktadan hallediliyor —, otomatik ilerleme
kaydı, taslak kaydet/yükle, geçmişten geri yükleme, rapor md/print), `i18n.js`
(tr/en metinler). `services/gemini_client.py`'ye dokunulmadı: `payload_json` şemasız,
self-explanatory key ile gidiyor (`personal_context` deseniyle aynı), EXPAND_PROMPT
zaten "RÜYA-EGO'NUN TUTUMU" ve "RÜYANIN BİTİŞİ"ni kör-nokta kategorisi olarak
tanımlıyor — artık ham veri karşılığı var. Bu üç alan opsiyonel, `dream_completion_pct`
hesaplamasına dahil edilmiyor (bilinçli sınır). Flask test_client ile HTML'de yeni
alanların render edildiği doğrulandı; **gerçek tarayıcıda tıklama/veri akışı testi
henüz yapılmadı — Kaan'ın kendi tarayıcısında denemesi gerekiyor.**

**1.2 Ritüel adımı — terk edildi (2026-09-10).** ~~Yorumdan sonra ayrı bir
ekran: önerilen ritüel + "yaptım" işareti + not.~~ Kaan bunu uygulamanın
kapsamı dışında tutmaya karar verdi — ritüeli kendisi, uygulamanın dışında
geliştirecek (bkz. Kurallar.md). Johnson'ın yönteminde ritüel gerçek bir
adım olmaya devam ediyor, sadece bu uygulamanın işi değil.

**1.3 Rezonans geri bildirimi — yapıldı (2026-09-12).** "Genişletme — Göremediğin
Yer" bloğunun altına 3 buton ("Oturdu / Kısmen / Oturmadı") + butona basınca açılan
tek satırlık not. Johnson'ın rezonans testi: bir yorum ancak bedensel bir tanıma
uyandırdığında doğrulanmış sayılır. Bilinçli olarak sadece AI genişletmesine bağlı
(kendi yorumuna "oturdu mu" sormak anlamsız) — Kaan'ın seçimi. Butona basınca
ayrı bir "kaydet" adımı olmadan hemen kaydediliyor; not yazarken 500ms gecikmeyle
otomatik güncelleniyor.

Bir keşif bu işi etkiledi: `/api/save-dream` her çağrıldığında yeni bir dosya
oluşturuyor (üzerine yazmıyor) ve tarayıcı hangi dosyaya kaydettiğini
saklamıyordu. Çözüm: `state.lastSavedFile`, `/api/save-dream`'in döndürdüğü
`saved_as` değerinden dolduruluyor; rezonans bu dosyaya `PATCH /api/dreams/<fname>`
ile yazılıyor. Bu endpoint (`rename_dream` → `patch_dream`) artık kısmi güncelleme
yapıyor — payload'da olmayan alana dokunmuyor, yani sadece rezonans göndermek
başlığı silmiyor (ve tersi). 6 yeni test (`scripts/test_dream_resonance.py`),
mevcut 26 test regresyon için tekrar koşuldu, hepsi yeşil.

**Kapsam dışı bırakılan, bilinen bir durum:** önce "Yorumumu Kaydet"e basılıp
sonra "Yorumu Genişlet" istenirse ilk dosya sunucuda öksüz kalıyor (ikincisi ayrı
bir dosya oluyor) — bu davranış bu değişiklikten önce de vardı, düzeltilmedi.

**Bilinçli sınır (Kaan'ın onayıyla, 2026-09-12): rezonans SADECE taze/canlı sonuç
ekranında var.** Kütüphaneden geçmiş bir rüya açıldığında (`showHistoryDetail`,
salt-okunur ayrı bir kod yolu) rezonans düğmeleri gösterilmiyor — analiz biter
bitmez verilmezse bir daha verilemiyor. Kaan bunu bilerek bu şekilde istedi,
genişletme talep edilmedi.

**Gerçek tarayıcıda test edildi (2026-09-12, Kaan) — çalışıyor.** (Test sırasında
bu oturumda birikmiş 12 tane eski/artık `python app.py` süreci fark edildi ve
temizlendi — ileride "değişiklik görünmüyor" sorununda önce bunu kontrol et:
`tasklist` ile birden fazla `python.exe app.py` çalışıp çalışmadığına bak.)

## Faz 2 — Rüya serisi

Uygulamayı "rüya yorumlayıcı"dan "bireyleşme takip aracı"na çeviren adım. Jung tek
rüyadan çok seriyi önemser; elde 6 kayıt var ama birbirleriyle hiç konuşmuyorlar.

**2.1 Tekrar eden semboller paneli — yapıldı (2026-09-12).** Kütüphaneye
"Tekrar Eden Semboller" düğmesi/paneli eklendi: `app.py`'de `recurring_symbols()`
(`name_en`'e göre normalize edilmiş gruplama, 2+ rüyada geçenler, en çok
tekrar edenden aza sıralı) + `GET /api/dreams/recurring-symbols` endpoint'i
(9 test, `scripts/test_recurring_symbols.py`, pytest'siz). Frontend: her
sembol satırı açılınca hangi rüyalarda geçtiğini ve **o rüyadaki seçilmiş
çağrışımı** gösteriyor — aynı sembolün anlamının zamanla değişip
değişmediğini görmek için. Yeni AI çağrısı yok, tamamen mevcut JSON'lardan
statik hesap. **Gerçek tarayıcıda test edildi (2026-09-12, Kaan) — çalışıyor.**

- ~~Tekrar eden semboller (`name_en` üzerinden eşleştirme — alan bunun için zaten var).~~ yapıldı, yukarı bkz.
- ~~Tekrar eden figürler, mekanlar~~ — ayrı bir tip alanı yok, `symbols` dizisi zaten
  hepsini kapsıyor, 2.1'deki panel bunları da örtüyor.
- ~~Zaman içinde değişen rüya-ego tutumu: geçen ay kaçıyordu, bu ay duruyor mu?~~
  yapıldı, bkz. **2.2**.
- Yeni endpoint: son N rüyayı alıp seri düzeyinde tema çıkaran ayrı bir sentez —
  henüz yapılmadı, bkz. 2.2'nin sonundaki not.

**2.2 Zaman içinde değişim görünümü — yapıldı (2026-09-13).** Kütüphaneye "Zaman
İçinde Değişim" düğmesi/paneli: Faz 1.1'in üç alanını (`dream_attitude`,
`dream_emotion`, `dream_arc`) tarih sırasıyla (eskiden yeniye) alt alta dizen bir
zaman şeridi. `GET /api/dreams` artık bu üç alanı da döndürüyor (`list_dreams`,
2 yeni test). Frontend tamamen kendi `/api/dreams` çağrısını yapıyor (kütüphanenin
`state.libraryDreams`'ine zamanlama yarışına girmeden güvenmek yerine — tekrar
eden semboller panelinin izlediği desenin aynısı). **Bilinçli olarak AI'sız:**
sadece kullanıcının kendi yazdığı cümleleri tarih sırasıyla listeler, örüntüyü
(kaçmaktan durmaya geçiş gibi) AI değil kullanıcı kendi gözüyle görür — Kaan'ın
tercihi, kota riski sıfır. Hiç veri yoksa (Faz 1.1 alanları henüz doldurulmamışsa)
bir "henüz veri yok" ipucu gösteriyor. **Ek (2026-09-13, Kaan'ın isteği):**
zaman şeridinde tarihin yanına varsa rüya başlığı da ekleniyor
(`"12 Eylül 2026 — Kara Köpek Rüyası"`).

**UX iyileştirmeleri — yapıldı (2026-09-13, Kaan'ın isteği).**

1. **Rüyayı en baştan isimlendirme.** Önceden başlık sadece kütüphaneden
   sonradan (kalem ikonuyla) verilebiliyordu, `buildRecord()`'da hiç `title`
   alanı yoktu. `step-dream`'e (rüya metninin üstüne) opsiyonel bir "Rüyana
   bir isim ver" alanı eklendi; Faz 1.1'deki 3 alanla aynı desende her yere
   (state, autosave, taslak, geri yükleme, sıfırlama) bağlandı. Kütüphaneden
   sonradan yeniden adlandırma aynen duruyor, çakışma yok.
2. **"Çalışman" kartında her şey düzenlenebilir.** Önceden sadece sembol ADI
   kalem ikonuyla düzenlenebiliyordu; bağlam, seçilen çağrışım ve 4 soru
   cevabı salt-okunurdu. Hepsine aynı kalem-ikonu deseni eklendi
   (`renderWorkCard`, `makeRenameControl` yeniden kullanıldı). Düzenleme her
   zaman `state.symbols[state.workIndex]` (`liveSym`) üzerine yazılıyor —
   `record.symbols[i]` `buildRecord()`'un ürettiği bir KOPYA olduğu için oraya
   yazmak state'e geri yansımaz (mevcut `renameSymbol` da bu yüzden ayrıca
   `state.lastRecord`'u da yamıyor). Boş gönderim yok sayılıyor (sembol adı
   düzenlemesiyle aynı davranış). `report_note`'a dokunulmadı — o zaten wheel
   adımında düzenlenebiliyor.

Kaan'ın netleştirmesi (seçilen çağrışım düzenlemesi için): kişi "karanlık"
yazıp seçtikten sonra aklına daha iyi bir kelime gelip "gece" olarak
düzeltirse, o andan sonra kabul edilen değer "gece" olmalı — düzenleme
metni değiştirir, "seçili" olma durumunu değiştirmez. Bu davranış
uygulandığı gibi.

Flask test_client ile HTML'de yeni `dream-title` alanının render edildiği
doğrulandı; mevcut 28 Python + 7 Node test regresyon için tekrar koşuldu,
hepsi yeşil. **Gerçek tarayıcıda test edildi (2026-09-13, Kaan) — "Çalışman"
kartındaki düzenleme çalışıyor.**

**Rüya silme — yapıldı (2026-09-13, Kaan'ın isteği).** Kütüphanede silme yoktu.
Eklenenler:
- Backend: `DELETE /api/dreams/<fname>` (tek kayıt, 404 yoksa) ve
  `DELETE /api/dreams` (hepsi, `.json` olmayan dosyalara dokunmaz, silinen
  sayıyı döner) — 6 yeni test, `scripts/test_dream_delete.py`.
- Frontend: her kütüphane kartının altına çöp kutusu ikonu (tek silme);
  `library-controls`'a "Tümünü Sil" düğmesi (kırmızı, `.btn-danger`).
- **Bilinçli kapsam (Kaan'ın onayıyla):** "Tümünü Sil" aktif filtreden
  bağımsız, kütüphanedeki GERÇEKTEN tüm kayıtları siler — "Tümünü İndir
  (.zip)"in filtrelenmiş görünüme uyan davranışından farklı, bilerek: yıkıcı
  bir eylemde belirsizlik istenmedi.
- Her iki silme de `window.confirm()` ile onay istiyor (tekli: isim, toplu:
  kaç kayıt silineceği).

Toplam 40 Python + Node test yeşil. **Gerçek tarayıcıda henüz test edilmedi.**

**Test/Dev paneli — yapıldı (2026-09-13, Kaan'ın isteği).** "Her adımdaki
sayfaları görebileceğim bir test ekranı" ihtiyacı için: `localhost:5000/?dev=1`
ile açılan, üretimde tamamen gizli bir şerit (`#dev-panel`). Her uygulama
adımına (Rüya Yaz / Semboller / Çark / Çalışman / Sonuç-kendi yorum /
Sonuç-AI) tek tıkla, tamamen **uydurma** bir örnek rüya kaydıyla atlıyor —
gerçek `ruyalar/` klasörüne dokunmadan (PRODUCT.md kuralı: gerçek rüya verisi
asla demo/test içeriği olmaz). Kütüphane adımı istisna: orada normal "Geçmiş
Rüyalarım" düğmesiyle aynı davranışla gerçek veri gösteriliyor (salt-okunur,
sakıncası yok). Yeni backend/veri-mantığı yok, sadece mevcut fonksiyonların
(`buildRecord`, `renderResult`, `selectSymbol`, `showOnlyStep`,
`renderFinalizeWorkspace`, `renderChips`) uydurma veriyle çağrılması. HTML'de
render edildiği doğrulandı. **Gerçek tarayıcıda henüz test edilmedi.**

**Sıradaki seviye (istenirse, henüz yapılmadı):** bu zaman şeridindeki veri
birikince, AI'a "son N rüyanda tutumun nasıl değişti" gibi bir özet
çıkarttırmak — istek üzerine çalışan ayrı bir uç nokta (mevcut "Yorumu Genişlet"
gibi, otomatik değil). Kaan bilerek önce statik veriyi biriktirmeyi, AI özetini
sonraya bırakmayı seçti (2026-09-12, kota kaygısı).

## Faz 3 — Kalite ve maliyet

**3.1 ~~Amplifikasyonu daralt~~ — vazgeçildi.** İlk halinde "sentez zaten çoğu
sembolü eliyor, o zaman aramadan önce 3-5 sembole daralt" deniyordu. Bu yanlıştı:
hangi sembolün amplifikasyondan gerçekten faydalanacağı ancak sentez adımında,
tüm çağrışım+soru verisi bir arada görüldüğünde belli olur — önceden daraltmak
Johnson'ın "amplifikasyon her sembol için meşru bir ikinci kaynaktır" ilkesine
aykırı olurdu.

**3.1b ~~Tavily → DuckDuckGo → Gemini grounding~~ — üç aşamalı elemeden sonra
"model kendi bilgisini kullansın, hiç arama yapmasın"a karar kılındı.** Önce
Tavily kaldırılıp DuckDuckGo (`ddgs`) tek kaynak yapılmıştı, ama uygulamayı
ücretsiz bir hosting'e koyma planı ortaya çıkınca bu da sorun oldu: `ddgs`
resmi bir API değil, paylaşımlı hosting IP'lerinde DDG tarafından engellenme
riski yüksek. Sonra Gemini'nin kendi "Google Arama" (grounding) aracı
denendi (`tools=[types.Tool(google_search=types.GoogleSearch())]`) — ama
canlı testte **ilk istekte 429 RESOURCE_EXHAUSTED** verdi; grounding
olmadan aynı istek anında başarılı oluyordu, yani sorun kod değil, kota:
"ayda 5.000 ücretsiz grounded sorgu" kotası billing (kart) açık projelere
tanınıyor, billing'siz API key'de grounding kotası sıfır çıktı. Kart
eklemek istenmediği için üçüncü seçeneğe geçildi: hiç arama aracı kullanma,
model ADIM 7'de kendi eğitim verisindeki mitoloji/arketip bilgisine
güvensin, ama sadece gerçekten emin olduğu iyi bilinen paralellerde — emin
olmadığı/uydurma riski taşıyan bir "bilgiyi" asla kullanmasın diye prompt'a
ayrıca uyarı eklendi. Sonuç: `services/duckduckgo_client.py` silindi,
`requirements.txt`'den `ddgs` çıkarıldı, `app.py`'den `/api/search-symbol`
kalktı, `synthesize_interpretation`'daki `tools=` parametresi ve grounding
kaynak çıkarma kodu (response'tan `grounding_metadata` okuma) kaldırıldı,
`/api/synthesize` tekrar düz `{"interpretation": ...}` döndürüyor,
`main.js`'deki "Amplifikasyon Kaynakları" listesi ve `result-sources`
CSS'i kullanılmayan veri için UI bırakmamak adına tamamen silindi. Artık
hiçbir dış arama servisine bağımlılık yok, tek gereken `GEMINI_API_KEY`.

**Kalıcı depolama riski de aynı oturumda çözüldü:** ücretsiz hosting'lerin çoğu
diski kalıcı değil (`ruyalar/` klasörü sunucu yeniden başladığında silinebilir).
Sunucu tarafında bir çözüm aramak yerine sonuç ekranına ve geçmiş detayına
"İndir (.txt)" butonu eklendi — rüya metni, her sembol için bağlam/seçilen
çağrışım/diğer çağrışımlar/4 soru cevabı, ve son yorum tek bir düz metin
dosyasına dökülüp tarayıcıdan indiriliyor (`static/js/main.js`
`buildExportText`/`downloadText`). Sunucu deposu artık "iyi olursa kalır,
olmazsa da kullanıcının kendi indirdiği kopya var" şeklinde ikincil önemde.

**3.2 Structured output.** `extract_symbols` şu an ham JSON parse ediyor; Gemini'nin
`response_schema` desteği format hatası riskini sıfırlar. Küçük modellerde asıl
kırılganlık burası.

**3.3 Model ayrımı — yapıldı (2026-09-08).** Çıkarma `GEMINI_MODEL`
(`gemini-flash-lite-latest`, ucuz+yüksek kota) üzerinde kaldı, sentez artık ayrı
`GEMINI_SYNTHESIS_MODEL` (`gemini-flash-latest`) kullanıyor. Sebep: flash-lite
sentez adımında gerçek Jungiyen bağ kurmuyordu, sadece veriyi şiirsel biçimde
yeniden anlatıyordu — Kaan'ın gözlemi. Free tier'de flash-lite en yüksek günlük
kotaya sahip ama en zayıf muhakemeye; flash bir üst kademe, hâlâ ücretsiz, günlük
kota kişisel kullanım için fazlasıyla yeterli.

**3.3b AI çağrı haritası (2026-09-10 eklendi, 2026-09-10 aynı gün ayrı oturumda
güncellendi — provider değişince bu tablo da güncellenmeli).** `extract_symbols`
artık `SYNTHESIS_PROVIDER`'ı hiç okumuyor, her zaman native Gemini kullanıyor —
bkz. aşağıdaki "Kota testi doğrulandı" bulgusu. `expand_interpretation` ve
`amplify_symbol` hâlâ aynı değişkeni kontrol ediyor (merkezi tek bir yönlendirme
yok, bilerek — tek bir yerde toplamak istenirse `services/gemini_client.py`'de
ortak bir `_resolve_provider()` helper'ı düşünülebilir, henüz yapılmadı):

| Çağrı | Dosya | Provider |
| --- | --- | --- |
| `extract_symbols` | `services/gemini_client.py` | **Her zaman Gemini**, `GEMINI_MODEL` (flash-lite) — `SYNTHESIS_PROVIDER` etkisiz |
| `expand_interpretation` | `services/gemini_client.py` → `groq_client.py` | `SYNTHESIS_PROVIDER=groq` ise Groq/`GROQ_SYNTHESIS_MODEL`, değilse Gemini/`GEMINI_SYNTHESIS_MODEL` |
| `amplify_symbol` | aynı | `SYNTHESIS_PROVIDER=groq` ise Groq/`GROQ_EXTRACT_MODEL` (yoksa sentez modeliyle aynı), değilse Gemini/`GEMINI_MODEL` |

`groq_client.extract_symbols` (ve sadece onun kullandığı `_parse_symbols_json`/
`_strip_json_fence` OTPM-kesilme kurtarma mantığı) artık hiçbir yerden
çağrılmadığı için silindi — geçmişi git'te duruyor, tekrar gerekirse commit
`02663a4` civarından geri alınabilir.

Not: local `.env`'de `SYNTHESIS_PROVIDER=groq` tanımlı (bir önceki oturumda
eklendi), Render dashboard'unda da `groq` set edilmiş durumda — ikisi artık
tutarlı, ama bu ayrımı unutmamak hâlâ gerekiyor (local ile canlı env'in
birbirinden bağımsız olduğu daha önce iki kez bulunmuştu).

**Model seçimi tercihi (2026-09-10):** Pareto/less-is-more'a göre sıfırdan
yazılan yeni `SYNTHESIS_PROMPT`, Groq/`qwen3.6-27b` (reasoning modeli) ile
test edilince Kaan sonuçları "çok beğendim" dedi. Buradan çıkan kural:
**ileride sentez için başka bir model değerlendirilecekse, ya aynı model
ailesinden (Qwen serisi) ya da reasoning yapabilen bir model olsun** — düz,
reasoning'siz modellerle karşılaştırma yapılmayacak.

## Faz 3.4 — Sembol Haritası (eklendi)

Kaan'ın isteği: yorumu okumadan önce rüyayı "bütün + parça" olarak görüp kendi
bağlantısını kendi kurabilmek — Obsidian graph/zihin haritası mantığı. Sonuç
ekranına ve geçmiş detayına `static/js/symbolmap.js` ile radyal bir ağaç
eklendi: rüya merkezde, semboller ilk halka, seçilen çağrışım ikinci halka.
Düğüme tıklayınca altında bağlam + 4 soru cevabı açılıyor. V1 kapsamı bilinçli
olarak dar tutuldu — yeni AI çağrısı yok, elimizdeki veriden statik çizim.

**Sonraki seviye (istenirse):** sembolleri birbirine bağlayan ortak temaları
gösteren gerçek bir graph (örn. "şu 3 sembol aynı kaçış temasına bağlı") —
bunun için Gemini'nin sentez çıktısına ayrı bir "temalar + hangi sembolleri
bağladığı" alanı eklemesi gerekir, prompt/şema tarafında ayrı bir iş.

## Rapor + Çalışma Sayfası — yapıldı (2026-09-10)

Plan: `C:\Users\USER\.claude\plans\fuzzy-growing-hickey.md`. Ham `.txt`
export'u kalktı, yerine "Rapor" (yeni pencere + tarayıcı yazdır/PDF akışı,
`main.js: buildReportHtml/openReport`) ve bağımsız bir "Çalışma Sayfası PNG"
export'u (`symbolmap.js: buildWorksheetSvg`, her sembol kendi kartında,
bağlam+altın çağrışım+diğer çağrışımlar+4 soru) geldi. Harita export'u
(sadece sembol+altın çağrışım, 4 soru YOK) değişmedi. Rapor için haritanın
aydınlık/kâğıt paleti eklendi (`PALETTE_PAPER`, `buildMapSvg(record, "paper")`).

Doğrulama: Chrome uzantısı bu makinede bağlı değildi, canlı tıklama testi
yapılamadı. Bunun yerine: (1) sunucudan render edilen HTML'de yeni
buton/ikonların varlığı `curl` ile doğrulandı, (2) `buildMapSvg`/
`buildWorksheetSvg`'in gerçek SVG kurulum mantığı Node'da bir DOM taslağı
içinde (15 sembollü gerçekçi test verisi + 1 sembollü + 0 sembollü uç
durumlar, hem koyu hem kâğıt tema) çalıştırılıp hatasız/geçerli boyutlar
ürettiği doğrulandı. **Gerçek tarayıcıda "Rapor" ve "Çalışma Sayfası PNG"
düğmelerine tıklayarak görsel/işlevsel doğrulama henüz yapılmadı — Kaan'ın
kendi tarayıcısında denemesi gerekiyor.**

Sırada: C (haritanın görsel kalite yükseltmesi) — Kaan'ın göndereceği ekran
görüntüsü/video referansı bekleniyor, kendi başıma tasarım turuna
girilmeyecek.

## Faz 4 — Vault entegrasyonu

Rüya kaydı JSON'un yanında Obsidian markdown'ı olarak da yazılsın (`obsidyen vault/`
klasörü zaten duruyor). QdkjOS'taki `knowledge/concepts/` kavramlarına
(gölge, anima, bireyleşme) `[[wikilink]]` ile bağlanabilir — rüyalar bilgi tabanının
bir parçası olur.

## Faz 5 — Dayanıklılık

- `ruyalar/` düz JSON klasörü: arama, filtre, silme, düzenleme yok. Seri analizi
  gelmeden önce en azından bir indeks dosyası gerekir.
- Uzun rüyalarda `max_output_tokens=8192` sınırına yaklaşılıyor.
- `.env` ve `api.txt` gitignore'da, takip edilmiyor — bu taraf temiz.
- `requirements.txt` install edilmemiş olabilir (`ddgs` zaten kodda vardı ama
  ortamda kurulu mu doğrulanmadı) — çalıştırmadan önce `pip install -r
  requirements.txt` gerekebilir.

## Önerilen sıra

~~3.1b~~ (yapıldı) → ~~1.1~~ (yapıldı) → ~~1.3~~ (yapıldı) → 1.2 → 2 → 3.2/3.3 → 4 → 5

Gerekçe: 3.1b (Tavily → DuckDuckGo) bu oturumda yapıldı. Sırada 1.1 var: yeni
sentez promptunun beklediği veriyi (rüya-ego tutumu, duygusal ton, çözülüş) besler
ve tek başına yorum kalitesini en çok artıran değişikliktir. 1.3 erken gelirse
sonraki her değişikliği ölçebilir hale gelirsin.

## Faz 3.6 — Kendi yorumun + "Yorumu Genişlet" (2026-09-11, uygulandı)

Ürün yönü kararı burada koda döndü: **AI birincil değil.** Eski, her zaman
çalışan `synthesize_interpretation` adımı kaldırıldı; yerine iki ayrı şey geldi.

**1) Kendi yorumun asıl bölüm.** Yorum adımı artık bir metin alanı: kullanıcı
kendi yorumunu yazıyor, `my_interpretation` olarak kayda ve otomatik ilerleme
kaydına giriyor. Rüyayı bitirmenin asıl yolu "Yorumumu Kaydet" — yapay zekaya
hiç sormadan.

**2) "Yorumu Genişlet" kilitli.** Yapay zeka düğmesi kendi yorumun en az 120
karaktere ulaşana kadar pasif (`MIN_OWN_INTERPRETATION_CHARS`). Gerekçe
yavaşlık: anında cevap veren bir kutu, beklemesi gereken yerde kişiyi kısayola
çeker (Threads.md'deki "trickster dürtüsü" tartışması). Sunucu tarafında da
aynı kontrol var — `/api/expand-interpretation` yorumsuz isteği 400 ile
reddediyor. Genişletme sonuç ekranından da istenebiliyor (kaydettikten sonra,
istediği gün).

**3) `SYNTHESIS_PROMPT` → `EXPAND_PROMPT`.** Görev değişti: yeni yorum yazmak
değil, kullanıcının yorumuna girmemiş olanı göstermek. Beş kör nokta yeri
(atlanan sembol, kendi cümlesinin ağırlığı, görülmeyen karşıtlık, rüya-ego'nun
tutumu, rüyanın bitişi) ve beş kural (parafraz etme, not verme, imgede kal,
gerilimi çözme, uydurma). Çıktı 200-350 kelime, son cümle bir soru. Prompt
4.9k'dan 3.4k karaktere indi (Pareto). Ritüel önerisi kaldırıldı — ritüel
kapsam dışı, Kaan kendisi geliştiriyor.

**4) Rapor artık iki çıktı + bir seçenek.** Rapor düğmesi küçük bir menü açıyor:
"Yapay zeka genişletmesi de girsin" onay kutusu (kayıtta genişletme yoksa
gizli), sonra **.md indir** ya da **Yazdır / PDF**. Markdown asıl arşiv formatı —
YAML frontmatter (tarih, sembol listesi, `has_ai_expansion`) ile Obsidian/
Dataview'a doğrudan giriyor. Her iki çıktıda da kendi yorum bölümü var.
Markdown'da harita YOK (SVG'yi nota gömmek dosyayı okunmaz hale getiriyor);
harita yazdır/PDF çıktısında ve ayrı PNG export'ta duruyor.

Yeniden adlandırmalar: `synthesize_interpretation` → `expand_interpretation`,
`_synthesis_model_name` → `_expand_model_name`, `/api/synthesize` →
`/api/expand-interpretation`, `scripts/test_synthesis.py` →
`scripts/test_expand.py` (fixture'da artık `my_interpretation` zorunlu).

## Faz 3.7 — Uygulandı (2026-09-11, ayrı bir oturumda kodlandı)

Aşağıdaki 5 madde kodlandı ve Node/DOM taslağıyla (0/1/8/15/20 sembollü
sentetik veri, hem `buildMapSvg` hem `buildWorksheetSvg`) hatasız çalıştığı
doğrulandı; ayrıca uygulama yerelde başlatılıp giriş yapılarak sunucudan
dönen HTML/CSS/JS'te yeni elemanların (cycle nav düğmeleri,
`#finalize-map-svg` CSS kuralı, `RING_ORDER` sırası, `mapDataUri`'nin
kaldırıldığı) gerçekten var olduğu `curl` ile teyit edildi. **Gerçek
tarayıcıda tıklama testi (çember tersine döndü mü, harita zoom'u tavana
takılmadan açılıyor mu, ‹ › gezinme çalışıyor mu) henüz yapılmadı — Kaan'ın
kendi tarayıcısında denemesi gerekiyor.**

Plan dışı bir ek karar: "Çalışman" (madde 3) sadece gezinme eklemekle
kalmadı, **tek kart görünümüne döndü** (eskiden tüm semboller alt alta aynı
anda duruyordu) — Kaan'ın seçimi. Aynı turda ayrıca **"Diğer Çağrışımlar"
alanı** dört gösterim yüzeyinden tamamen kaldırıldı: Çalışman kartı, Rapor
(Yazdır/PDF) kartı, Rapor Markdown, Çalışma Sayfası PNG — Kaan'ın isteği,
PLAN.md'de daha önce yoktu.

### Karar (uygulanacak bir şey yok)
- **Meditasyon notları hiçbir yere girmiyor.** Kaan netleştirdi: ne rapora,
  ne yapay zekaya. Yalnızca kayıtta/otomatik ilerleme kaydında duruyor.
  Mevcut davranış zaten bu — değişiklik gerekmiyor, kural olarak sabit.

### 1. Çemberde iç/dış yer değişimi — yapıldı
`RING_ORDER` `["assoc", "name"]` → `["name", "assoc"]` çevrildi: artık içte
sembol adı, dışta altın çağrışım. `RING_WEIGHT` role bağlı kaldığı için
kalınlık otomatik doğru halkaya uygulandı, `fitCellText`'e dokunulmadı —
Node/DOM taslağında 0/1/8/15/20 sembolde hatasız üretim doğrulandı, gerçek
tarayıcıda gözle teyit Kaan'da.

### 2. Yorum adımındaki harita çok uzun, uzaklaştırma çalışmıyor — yapıldı
İki düzeltme de uygulandı:
- `style.css`'teki `#symbol-map-svg, .history-map-svg` selector listesine
  `#finalize-map-svg` eklendi.
- `applyZoom`'daki sabit tavan (`base.w * 2.2`) yerine, tuvalin o anki tam
  boyutu (`svg.__vbFull`, `buildSunburstSvg` içinde hesaplanıyor) tavana
  dahil edildi — soru kutuları ne kadar büyük açılırsa açılsın zoom-out
  tavanı onu kapsayacak şekilde büyüyor.

### 3. Semboller arası "cycle" (özellikle mobil) — yapıldı
Çark adımına ve "Çalışman" bölümüne `‹ sembol adı ›` biçiminde dairesel
gezinme eklendi (`main.js`: `cycleWheelSymbol`, `cycleWorkCard`). Ek karar:
"Çalışman" aynı zamanda **tek kart görünümüne** döndü — artık tüm semboller
alt alta değil, gezinmeyle tek tek görünüyor (Kaan'ın seçimi).

### 4. Markdown raporundan gömülü harita kaldırılacak — yapıldı
`buildReportMarkdown` içindeki harita bloğu ve `SymbolMap.mapDataUri` (artık
hiçbir yerden çağrılmadığı için) silindi. Harita yazdır/PDF çıktısında ve
ayrı PNG export'unda değişmeden kaldı.

### Ek: "Diğer Çağrışımlar" alanı kaldırıldı — yapıldı
Planda yoktu, oturum içinde Kaan'ın isteğiyle eklendi: "diğer çağrışımlar"
alanı dört gösterim yüzeyinden de çıkarıldı — Çalışman kartı, Rapor
(Yazdır/PDF) kartı, Rapor Markdown, Çalışma Sayfası PNG. Veri
(`all_associations`) kayıtta duruyor, sadece bu dört yerde gösterilmiyor.
Eski `.txt` içe aktarma ayrıştırıcısındaki `"Diğer çağrışımlar:"` satırına
dokunulmadı (eski dosyaları okumaya devam edecek).

### 5. İleride: çok sembolde birden fazla harita
15'ten fazla sembolde ikinci çember zaten üretiliyor. Kaan bunun ileride
"2 harita" olarak görüneceğini not etti — o noktada yerleşimin (ve yeni
gezinmenin) yeniden gözden geçirilmesi gerekebilir. Şimdilik aksiyon yok.

## Görsel yeniden tasarım — "Gece Rasathanesi" (2026-09-13)

Kaan: "siteyi bir gözden geçir... çok cheesy duruyor, minimal işe yarıyor ama
albenisi yok." `/frontend-design:frontend-design` skill'i ile üç yön
önerildi, Kaan **Direction B — Gece Rasathanesi (Night Observatory)**'yi
seçti ve uygulama sırasını onayladı: 1) global tema, 2) çark, 3) harita,
4) genel UI.

**Ne:** Kâğıt & kalem (krem zemin, lacivert mürekkep) teması tamamen
kaldırıldı; yerine karanlık gece zemini + parşömen metin + sıcak
alev/kehribar vurgu + kor kızılı ikincil vurgu geldi.

- `style.css` `:root`: `color-scheme: light` → `dark`, tüm renk tokenları
  (`--bg`, `--card-bg`, `--text`, `--accent`, `--gold`, `--ring`, vb.)
  yeni palete çevrildi. Başlık fontuna Fraunces eklendi (Cormorant
  Garamond'ın yedeği olarak kaldı).
- Değişkene bağlı olmayan ~6 tekil kural elle düzeltildi: `body`'nin kâğıt
  dokusu → yıldız tozu + kubbe ışığı; `.app-header` translucent zemin;
  `.btn-primary` metin/gölge renkleri; `.card` ve `.report-menu` box-shadow;
  `.login-glow` radial-gradient.
- **Dokunulmadı (bilinçli):** `main.js`teki `buildReportHtml` (yazdır/PDF
  raporu) kendi ayrı `:root`'unu kullanıyor, kağıt/açık tema olarak
  kalmalı — dokunulmadı.
- **Sembol Çarkı (`wheel.js` + CSS):** merkez madalyon ve seçili ok ucu
  gradyanları yeni palete çevrildi (artık "ay ışığıyla aydınlanan bir
  madalyon" + "alevin kendisi" temalı). Seçili ok/uç artık `drop-shadow`
  ile hafif kor parıltısı veriyor. 3D etkileşim eklendi: `.wheel-svg-wrap`e
  `perspective`, `#wheel-svg`e `transform-style: preserve-3d` + spring
  easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) geçişi; `main.js`teki yeni
  `attachTilt()` fonksiyonu fare/kalem konumuna göre çarkı hafifçe eğiyor
  (max ±9°), dokunmatikte devre dışı (parmak zaten swipe-cycle kullanıyor).
- **Sembol Haritası (`symbolmap.js`):** ekran paleti (`PALETTE`) yeni
  temaya çevrildi; rapor/export paleti (`PALETTE_PAPER`) kâğıt teması
  olarak bilerek dokunulmadı (basılı çıktı hâlâ açık zeminde kalmalı).
- Testler: CSS/JS görsel değişiklik olduğu için backend testlerinde
  (40 Python + 7 Node) regresyon beklenmiyordu, çalıştırıldı ve hepsi
  yeşil kaldı. Tarayıcıdan `?dev=1` panosu üzerinden çark/harita/kütüphane
  görsel olarak doğrulandı.

**Faz 3/4 kararı:** Haritaya ekstra "takımyıldız çizgisi" gibi süslemeler
eklenmedi — sunburst'ün her dilimi zaten merkezden kenara bir çizgi
(radyal yapının kendisi bunu veriyor), üstüne render eklemek projenin
kendi "less is more" ilkesiyle (bkz. `symbolmap.js` başındaki not,
Kaan 2026-09-11) çelişirdi. Genel UI (Faz 4) için ayrı bir düzenleme
gerekmedi: neredeyse tüm arayüz (butonlar, çipler, kartlar, rozetler,
odak/focus-visible halkası) zaten aynı `:root` tokenlarından besleniyor,
bu yüzden Faz 1'in tema değişimi otomatik olarak her yere yayıldı —
`?dev=1` panosundan Rüya Yaz / Çark / Yorum / Kütüphane ekranları tek
tek kontrol edildi, hiçbirinde eski açık temadan kalan bir iz yok.
**Görsel yeniden tasarım turu bu haliyle tamamlandı.**

## Faz 1.2 (yeniden açıldı) — Ritüel adımı + Jungcu Rehber (2026-09-13)

**Karar tersine döndü:** 2026-09-10'da ritüel bilerek kapsam dışı bırakılmıştı
("Kaan kendisi geliştirecek"). Kaan bu oturumda fikrini değiştirdi: ritüelin
yazılıp kaydedileceği ve sonradan "yaptım" diye işaretlenebileceği bir yer
istedi. Uygulama hâlâ ritüelin İÇERİĞİNİ önermiyor — sadece yazmak/kaydetmek/
işaretlemek için bir yer veriyor; bu, orijinal kararın ("dışarıdan verilen
ritüel yöntemin kaçındığı şeydir") özünü koruyor.

**Ne yapıldı:**
- **Ritüel paneli** (`#ritual-panel`), sonuç ekranında (`#ai-block`'un
  altında, her zaman görünür — kendi yorum ya da AI genişletmesi fark
  etmez): kısa Johnson açıklaması + textarea + "Ritüeli Kaydet" butonu.
  `ritual_text` alanı, rezonansla birebir aynı desende
  `PATCH /api/dreams/<fname>` ile `state.lastSavedFile`'a yazılıyor.
- **Kütüphanede tamamlama işareti — rezonanstan FARKLI olarak HER ZAMAN
  değiştirilebilir** (ritüel günler sonra yapılabileceği için): `ritual_text`
  dolu olan her kartta bir "yaptım" düğmesi (`ritual_done: true/false`,
  aynı PATCH endpoint'i), kartta ayrı renkte (`--green`) bir "✓ Ritüel
  yapıldı" rozeti.
- **Backend:** `patch_dream` genişletildi (`ritual_text`/`ritual_done`,
  ikisi de sadece payload'da GEÇERSE dokunuluyor — title/resonance'ı
  silmiyor); `list_dreams` artık `has_ritual`/`ritual_done` döndürüyor.
  7 yeni test (`scripts/test_dream_ritual.py`).
- **Rapor entegrasyonu:** hem `.md` hem yazdır/PDF raporuna "Ritüel"
  bölümü eklendi (metin + yapıldı/yapılmadı durumu); `.md`'nin YAML
  frontmatter'ına da `ritual_done` eklendi (Dataview filtrelemesi için).
  Ayrıca `.md`'ye, Çalışman ile aynı ölçüde kartların hiç tekrarı olmayan
  kısa bir "Sembol Haritası" özet listesi eklendi (`sembol adı → seçilen
  çağrışım`, tek satır) — bkz. aşağıdaki ASCII harita notu.
- **Jungcu Rehber** (`#step-guide`, header'da yeni "Rehber" linki):
  geçmiş paneliyle aynı taşma-ekran deseni (STEP_ORDER dışı, `lastMainStep`
  korunuyor). İki bölüm: Johnson'ın 4 adımının uygulamadaki karşılığı
  (kısa liste) + temel Jungiyen kavramlar sözlüğü (gölge, anima/animus,
  persona, bireyleşme). Tamamen statik, AI çağrısı yok.
- `johnson.ritual` metni (Çalışman adımındaki "Johnson'ın ölçütleri"
  bölümünde) güncellendi: artık "ritüeli sana bu uygulama öneremez"
  ilkesini koruyarak, sonuçta yazıp kaydedebileceğin yeni yeri işaret
  ediyor.

**ASCII sembol haritası kararı (Kaan'ın sorusu üzerine):** Literal bir
ASCII çark ÇİZİLMEDİ — sunburst'ün açısal yapısı monospace grid'de sahte
bir daireye dönüşür, tam da yeniden tasarımın kaçındığı "cheesy" hissi
markdown'a taşırdı. Onun yerine gerçek değer taşıyan bir özet eklendi:
her sembol için tek satırlık `isim → seçilen çağrışım` listesi (sunburst'ün
iki halkasının metin karşılığı) — zaten var olan "Sembol Çalışma Sayfası"
bölümünün (bağlam + 4 soru) tekrarı değil, sadece hızlı bir bakış.

**Doğrulama:** Backend 7 yeni test + 34 mevcut test yeşil (toplam 41
Python + 7 Node). Tarayıcıdan gerçek uçtan uca akış test edildi: uydurma
`?dev=1` verisiyle "Yorumumu Kaydet" → gerçek `/api/save-dream` çağrısı →
ritüel metni yazıp "Ritüeli Kaydet" → "Kaydedildi." durumu → kütüphaneye
gidip "yaptım" işaretlendi → "✓ Ritüel" rozeti göründü. Test kaydı
doğrulama sonunda silindi (fabrikasyon veri, `ruyalar/`'da kalıcı
bırakılmadı). Rehber sayfası da tıklanıp içerik/geri-dönüş akışı
doğrulandı.

## Backlog (henüz brainstorm edilmedi — sadece fikir aşamasında, 2026-09-13)

Kaan'ın bu tarihte açtığı, PRODUCT.md'ye ("kuş bakışı" hedefi + modülerlik
ilkesi) işlenen ama henüz tasarlanmamış iki büyük fikir. İkisi de mimari
ölçekte (yeni alt-sistem / mevcut akışın yeniden yapılandırılması), bu
yüzden kodlamaya geçmeden önce ayrı bir brainstorm turu gerekiyor.

**Kuş Bakışı Görünüm — yapıldı (2026-09-13).** İlk yorum yanlış anlaşılmıştı
(kesişen-rüyalar dashboard'u sanılmıştı) — Kaan netleştirdi: "tek bir
rüyanın tüm istatistiklerini görmek", Iron Man'in bir elementi incelerken
o TEK elementin tüm verisini aynı anda görmesi gibi. İlk tasarım önerisi
(her sembol için tam kart: bağlam+4 soru+not) da fazla "doküman" gibi
bulundu — Kaan "çok daha kompakt" istedi. Sonuç: `showHistoryDetail`
(main.js) bir rüyayı açtığında artık üstte kompakt bir "HUD şeridi" var:

- Başlık + tarih · sembol sayısı · tamamlanma % rozeti · (varsa) ritüel
  durumu rozeti ("✓ Ritüel yapıldı" / "Ritüel bekliyor").
- Rüya düzeyi alanlar (tutum/duygu/seyir) — SADECE doluysa, tek satır
  etiket:değer (timeline panelinin `.timeline-fields` deseni yeniden
  kullanıldı).
- Her sembol için TEK satır: `isim → seçilen çağrışım` — 4 sorunun tam
  cevabı YOK, bağlam paragrafı YOK. Detay hâlâ aynı yerde: haritadaki
  altın çağrışıma tıklayınca açılıyor, burada tekrar edilmiyor.

Harita, Kendi Yorumun, AI Genişletmesi bölümleri değişmeden kaldı — bunlar
zaten kompakt değil, tam metin ve öyle kalmalı. Rezonans yine bilerek
gösterilmiyor (önceki karar, değişmedi). Yeni backend/veri yok — tüm
alanlar zaten `GET /api/dreams/<fname>` ve `state.libraryDreams`'te
mevcuttu. Gerçek bir kayıt (`ahmet arslan`, 3 sembol) üzerinde tarayıcıda
görsel olarak doğrulandı.

**Modüler akış — çözüldü (2026-09-13), geri dönüp düzenleme YÖNÜNDE
DEĞİL.** Kaan'ın somut örneği: sonuç ekranına ulaştıktan sonra geri
dönüp sembol çarkında bir şey değiştiremiyorsun (akış tek yönlü: Rüya →
Semboller → Çark → Çalışman → Sonuç, `#step-result`'tan geri dönüş yolu
yok). Bunu "geri dönüp düzenlemeyi mümkün kılmak" yerine (ki bu, zaten
yazılmış "Kendi Yorumun"/AI genişletmesinin eskimesi gibi çözülmesi
gereken ayrı bir tasarım sorunu açıyordu) **Kaan kilidi baştan görünür
yapmayı seçti**: `btnFinish` ("Yorumumu Kaydet") ve `btnFinalize`
("Yorumu Genişlet") tıklanınca, adımı geri alınamaz hale getirmeden hemen
önce `window.confirm()` ile net bir uyarı çıkıyor — "Bunu kaydettikten
sonra sembollere/çarka geri dönüp düzenleme imkânın olmayacak. Emin
misin?" (`finalize.lockConfirm`, `main.js`). Onaylanmazsa hiçbir şey
olmaz, buton pasifleşmez. Bu, mevcut silme onaylarıyla (`window.confirm`,
Rüya silme özelliği) aynı deseni kullanıyor. Geri dönüp düzenleme
özelliği bu kararla YAPILMAYACAK olarak kapatıldı — PRODUCT.md'deki
ilgili ilke buna göre güncellendi.
