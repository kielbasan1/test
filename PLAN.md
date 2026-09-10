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

**1.1 Rüya düzeyi sorular.** Uygulama sadece sembol düzeyinde soru soruyor. Jungiyen
analizin en çok bilgi taşıyan üç verisi ise rüyanın bütününe ait:

- *Rüyada sen ne yapıyordun?* — rüya-ego'nun tutumu (katılan/izleyen, kaçan/duran).
  Uyanık ego tutumunun doğrudan aynası; çoğu zaman rüyanın en belirleyici tek detayı.
- *Rüyada ne hissettin, uyandığında hangi duygu kaldı?* — duygusal ton. Jung'a göre
  anlamın en güvenilir göstergesi; asıl bilgi, hissedilen duygunun "normalde"
  hissedilecek olandan sapmasında.
- *Rüya nasıl bitti?* — çözülüş var mı yok mu. Çözülüşsüz biten rüya, bilinçdışının
  henüz çözüm sunmadığı anlamına gelir ve bu başlı başına bir bulgudur.

Dokunulacak yerler: `templates/index.html` (step-dream'e üç alan), `static/js/main.js`
(payload'a üç alan), `services/gemini_client.py` (veri katmanları listesine ekle).

**1.2 Ritüel adımı — terk edildi (2026-09-10).** ~~Yorumdan sonra ayrı bir
ekran: önerilen ritüel + "yaptım" işareti + not.~~ Kaan bunu uygulamanın
kapsamı dışında tutmaya karar verdi — ritüeli kendisi, uygulamanın dışında
geliştirecek (bkz. Kurallar.md). Johnson'ın yönteminde ritüel gerçek bir
adım olmaya devam ediyor, sadece bu uygulamanın işi değil.

**1.3 Rezonans geri bildirimi.** Yorum ekranına "oturdu / kısmen / oturmadı" + tek
cümle not. Johnson'ın rezonans testi: bir yorum ancak bedensel bir tanıma
uyandırdığında doğrulanmış sayılır. Yan fayda: prompt değişikliklerinin işe yarayıp
yaramadığını ölçecek tek gerçek veri bu olur.

## Faz 2 — Rüya serisi

Uygulamayı "rüya yorumlayıcı"dan "bireyleşme takip aracı"na çeviren adım. Jung tek
rüyadan çok seriyi önemser; elde 6 kayıt var ama birbirleriyle hiç konuşmuyorlar.

- Tekrar eden semboller (`name_en` üzerinden eşleştirme — alan bunun için zaten var).
- Tekrar eden figürler, mekanlar, çözülüşsüz bitişler.
- Zaman içinde değişen rüya-ego tutumu: geçen ay kaçıyordu, bu ay duruyor mu?
- Yeni endpoint: son N rüyayı alıp seri düzeyinde tema çıkaran ayrı bir sentez.

Ön koşul: Faz 1.1 (rüya-ego ve duygu verisi olmadan serinin en anlamlı ekseni yok).

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
bkz. aşağıdaki "Kota testi doğrulandı" bulgusu. `synthesize_interpretation` ve
`amplify_symbol` hâlâ aynı değişkeni kontrol ediyor (merkezi tek bir yönlendirme
yok, bilerek — tek bir yerde toplamak istenirse `services/gemini_client.py`'de
ortak bir `_resolve_provider()` helper'ı düşünülebilir, henüz yapılmadı):

| Çağrı | Dosya | Provider |
| --- | --- | --- |
| `extract_symbols` | `services/gemini_client.py` | **Her zaman Gemini**, `GEMINI_MODEL` (flash-lite) — `SYNTHESIS_PROVIDER` etkisiz |
| `synthesize_interpretation` | `services/gemini_client.py` → `groq_client.py` | `SYNTHESIS_PROVIDER=groq` ise Groq/`GROQ_SYNTHESIS_MODEL`, değilse Gemini/`GEMINI_SYNTHESIS_MODEL` |
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

~~3.1b~~ (yapıldı) → 1.1 → 1.3 → 1.2 → 2 → 3.2/3.3 → 4 → 5

Gerekçe: 3.1b (Tavily → DuckDuckGo) bu oturumda yapıldı. Sırada 1.1 var: yeni
sentez promptunun beklediği veriyi (rüya-ego tutumu, duygusal ton, çözülüş) besler
ve tek başına yorum kalitesini en çok artıran değişikliktir. 1.3 erken gelirse
sonraki her değişikliği ölçebilir hale gelirsin.
