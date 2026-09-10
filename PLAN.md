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

~~3.1b~~ (yapıldı) → 1.1 → 1.3 → 1.2 → 2 → 3.2/3.3 → 4 → 5

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

## Faz 3.7 — Sırada (2026-09-11, Kaan'ın istekleri; HENÜZ YAPILMADI)

Kaan bu turda kota sınırına yaklaştığı için uygulama yapılmadı, yalnızca
plана yazıldı. Sıradaki oturumda buradan devam edilecek.

### Karar (uygulanacak bir şey yok)
- **Meditasyon notları hiçbir yere girmiyor.** Kaan netleştirdi: ne rapora,
  ne yapay zekaya. Yalnızca kayıtta/otomatik ilerleme kaydında duruyor.
  Mevcut davranış zaten bu — değişiklik gerekmiyor, kural olarak sabit.

### 1. Çemberde iç/dış yer değişimi
Şu an içte altın çağrışım, dışta sembol adı. Kaan tersini istiyor: **altın
çağrışım dış çepere** gelsin. `symbolmap.js`'te `RING_ORDER` içten dışa
sıralı (`["assoc", "name"]`) — `["name", "assoc"]` yapılacak. Dikkat:
halka kalınlıkları (`RING_WEIGHT`) role göre tanımlı, altın çağrışım daha
kalın (2.3) çünkü metni uzun; sıra değişince dış halka daha kalın olacak,
`fitCellText`'in yeniden doğrulanması gerekiyor (1-20 sembol taraması).

### 2. Yorum adımındaki harita çok uzun, uzaklaştırma çalışmıyor
Teşhis yapıldı, iki ayrı neden:
- **Asıl neden (bir satırlık düzeltme):** `style.css`'teki
  `#symbol-map-svg, .history-map-svg { width:100%; aspect-ratio:1/1;
  height:auto }` kuralına **`#finalize-map-svg` dahil değil.** Bu yüzden o
  SVG, öz nitelikleri olan `width`/`height` (3 sembolde 1735×1735) ile
  render ediliyor — devasa ve çok uzun duruyor, `.symbol-map-wrap`'in
  `overflow:hidden`'ı da kırpıyor. Selector listesine eklenecek.
- **İkincil:** `zoomAt` içindeki `clamp(vb.w * factor, base.w * 0.28,
  base.w * 2.2)` — uzaklaştırma tavanı taban görünümün 2.2 katı. Taban artık
  tuvalin tamamı değil çemberin kendisi olduğu için, soru kutuları açıkken
  gereken görünüm bu tavanı aşabiliyor. Tavan yükseltilecek (ya da tuvalin
  tamamına izin verecek şekilde bağlanacak).

### 3. Semboller arası "cycle" (özellikle mobil)
Çark adımında semboller arasında ileri/geri dolaşmak şu an yalnızca
"Sonraki Sembol" ve sembol listesine dönüp tıklamakla oluyor. Mobilde
zahmetli. İstenen: çarkın üstünde/altında **‹ sembol adı ›** biçiminde bir
gezinme (dairesel: sondan sonra başa dönsün). Aynı gezinme **"Çalışman"
bölümüne de** gelecek — kartlar alt alta uzun bir liste, tek tek dolaşmak
daha iyi.

### 4. Markdown raporundan gömülü harita kaldırılacak
Gömüldü ve teknik olarak çalışıyor (data-URI, parantezler kaçırılmış) ama
Kaan'ın kullanımında **görünmüyor/okunmuyor**. Kaldırılacak; harita
yazdır/PDF çıktısında ve ayrı PNG export'ta kalmaya devam edecek.
`buildReportMarkdown` içindeki harita bloğu ve `SymbolMap.mapDataUri`
silinecek.

### 5. İleride: çok sembolde birden fazla harita
15'ten fazla sembolde ikinci çember zaten üretiliyor. Kaan bunun ileride
"2 harita" olarak görüneceğini not etti — o noktada yerleşimin (ve yeni
gezinmenin) yeniden gözden geçirilmesi gerekebilir. Şimdilik aksiyon yok.
