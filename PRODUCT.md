# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user today: Kaan, using the app on himself for real personal dream
work, already fluent in Robert Johnson's *Inner Work* method. Confirmed
direction: the product should grow toward people who have **never heard of
Johnson's method** — the design must carry its own explanation/onboarding
rather than assuming prior familiarity. Both audiences must be able to use
the same flow; the newcomer layer is additive (explanation, orientation),
not a different product.

## Product Purpose

Helps a person apply Robert Johnson's four-step dream-work method
(association → dynamics → interpretation → ritual) to their own dream,
without an AI simply handing them a finished interpretation. The app
extracts the concrete symbols from a dream, lets the user build their own
free associations for each symbol (the "çağrışım çarkı" / association
wheel), asks Johnson's four deepening questions for the association the
user picks, then renders a compact radial map (dream center → symbols ring
→ chosen associations ring) so the user can hold the whole dream in view
while doing their own interpretive work. Success is the user completing a
grounded interpretation of their own dream, using the map and data as a
thinking aid — not receiving an AI verdict.

**The problem it actually solves (Kaan's own words, 2026-09-11).** Keeping
dreams on paper doesn't work for him — they don't accumulate, he can't find
anything, and nothing connects. The app is meant to be a **library of his
inner world**: a place where dreams are archived properly (clean file
formats), where what he's looking for is easy to find, where the collection
*grows* and becomes something he can connect, expand and analyse — recurring
symbols, recurring themes, statistics, unexpected similarities across
dreams. Part of the value is simply the good feeling of being organized:
inner work that is always within reach, that he can open, check and add to
at any moment.

Two consequences follow, and they are binding on design decisions:

1. **No drudgery.** Because everything lives on the computer, the app must
   not push clerical work back onto the user. Use has to feel *flowing* —
   never clunky, never "now fill in these fields". Any feature that adds
   bookkeeping burden is suspect by default.
2. **Archiving is a first-class feature, not an afterthought.** Records must
   be reliably saveable, retrievable, and in formats that stay usable
   (see the .json backup + report/print pipeline), because the whole point
   is a collection that survives and keeps growing.

**Çerçeve netleştirmesi (Kaan'ın kendi ifadesiyle, 2026-09-12).** Problem daha
keskin tanımlandı: elde düzgün bir kayıt olmasının ötesinde, herhangi bir rüya
metninin bağlamını (context) tek bakışta kavrayabileceği bir **medyum/harita
bulamamak** — ve bunun sonucunda **yorumu ve akıl yürütmeyi verimli
yapamamak**. Uygulama tam olarak bunu çözüyor: rüya metninin context'ini
hızla kavratan bir harita/medyum sunarak yorumlama ve akıl yürütmeyi
kolaylaştırıyor. Kullanıcının bu uygulamayı kullanma nedeni: **dream
journal, dream tracking, rüyalar arası eşleme (dream matching)**, ve analitik
farkındalıklarla **inner work yolculuğunu kayıt altına alıp progress'ini
takip edebilmek**. Tasarım kararları bundan sonra bu çerçeve etrafında
döner: her özellik "context'i daha kolay kavratıyor mu / yorumu ve
farkındalık takibini kolaylaştırıyor mu" sorusuna göre değerlendirilir.

**Yöntem-hız gerilimi ve "kuş bakışı" hedefi (Kaan'ın kendi ifadesiyle,
2026-09-13).** Kâğıda elle yazmak, yavaş yapmak, gerçekte daha keyifli ve
daha iyi hissettiriyor — ama arşivlenmiyor ve kolay erişilmiyor. Bu uygulama
o takası üstleniyor: Lincoln'ın "bir ağacı kesmek için bir saatim olsa 50
dakikasını baltamı bilemeye harcarım" sözü gibi, yöntemin hiçbir adımını
atlamadan mekanik/sistematik biçimde eksiksiz yapmak isteyenler için var.
Kullanıcının bu uygulamayı kullandıktan sonra eriştiği olması gereken şey:
**bütünü uzaktan, kuş bakışı görebileceği bir arayüz** — Iron Man'in yeni
bir element bulduğunda tüm veriye aynı anda bakabildiği arayüz gibi. Bu,
ürünün nihai hedeflerinden biri olarak kabul edildi (henüz tasarlanmadı —
bkz. PLAN.md'deki "Kuş Bakışı Görünüm" backlog maddesi).

**Uygulamanın asıl işi "boşluk doldurmak" değil, "boşluk YARATMAK"tır
(Kaan'ın kendi ifadesiyle, 2026-09-13).** Yapay zekanın (ya da uygulamanın)
görevi kullanıcı için cevapları doldurmak değil; kullanıcının kendi
dolduracağı yapılandırılmış boşlukları (sorular, alanlar, adımlar) açmak,
sonra kullanıcının ne yazdığına dayanarak tam/bütünleşik bir çıktı
üretmektir. Bu, mevcut "AI bana bunu yaptırsın" ilkesinin daha kesin bir
ifadesi: araç doldurmaz, alan açar.

## Positioning

Unlike a generic "AI dream interpreter" that answers instantly, Sembol
Çarkı structures Johnson's disciplined method step by step and treats the
visual map/data as the product's real deliverable. **Resolved (2026-09-10):**
the AI-generated synthesis is not the primary output. The user writes their
own interpretation first, using the map and collected data as a thinking
aid. The AI's role is a secondary, on-demand "kör nokta" (blind spot)
assistant — analogous to the existing single-symbol "amplify" button, but
at the whole-interpretation level: given all collected data plus the
user's own written interpretation, it points out what a professional
Jungian analyst would likely notice that the user's interpretation missed.
It never generates a from-scratch interpretation; it always requires the
user's own interpretation as input first.

**Ek netleştirme (Kaan'ın kendi ifadesiyle, 2026-09-12): "AI bana bunu
yaptırsın."** Amaç sadece istenince yanıt veren pasif bir araç olmak değil
— yapay zeka, kullanıcıyı rüya analizini **bizzat kendisinin yapmasına**
iten/yönlendiren bir unsur olmalı. Bu, mevcut "Yorumu Genişlet" kilidiyle
(kendi yorumu en az 120 karaktere ulaşmadan AI'a erişilememesi) zaten aynı
yöndeki bir tasarım kararı; ama artık bir yan etki değil, ürünün amacının
doğrudan bir parçası: yapay zekanın işlevi analizi kullanıcının yerine
yapmak değil, kullanıcıyı kendi analiz eylemine sokmaktır.

## Operating Context

Personal, often late-night/just-woken dream-journaling moment. Flask web
app, Jinja2 templates, vanilla JS frontend; local dev via `python app.py`
on `localhost:5000`. Deployed to Render's free tier, whose disk is
**not persistent** — the `ruyalar/` JSON store can be wiped on restart,
which is why a client-side ".txt indir" export exists as the user's only
guaranteed copy. The whole app currently sits behind one shared password
(`APP_PASSWORD` in `.env`), not per-user accounts.

## Capabilities and Constraints

- Confirmed flow: dream text → Gemini extracts concrete symbols (no
  interpretation at this step) → per-symbol association wheel (user adds
  free associations as "arrows", picks the one that "clicks") → Johnson's
  4 deepening questions for the picked association → one synthesis call
  over all collected data → radial symbol map shown *before* the written
  interpretation → result saved as JSON in `ruyalar/`, downloadable as
  `.txt`.
- **Durable rule, not a stylistic choice:** personal association always
  outranks mythological/cultural amplification in the synthesis; the
  synthesis only adds a mythological parallel when genuinely confident
  (at most 3-5 heavily-loaded symbols), and skips it entirely otherwise.
  No external search dependency — Tavily, DuckDuckGo, and Gemini's Google
  Search grounding were all tried and removed (cost, reliability, or
  hosting-IP-blocking reasons); the model uses only its own training
  knowledge and is instructed to say nothing when unsure.
- **No per-user data isolation.** Auth is one shared password for
  everyone; all saved dreams live in a single shared `ruyalar/` folder.
  This must be resolved before the app is genuinely opened to people
  beyond Kaan — dream material is by nature private and sometimes deeply
  so, and must never become visible to another user.
- **Shipped (2026-09-11):** the always-run AI synthesis is gone. The user
  writes their own interpretation; the AI is an on-demand "yorumu genişlet"
  action that takes that interpretation plus all collected data (symbols,
  associations, 4-question answers) and surfaces the blind spots the
  interpretation missed — it never writes an interpretation from scratch.
  It stays locked until the user's own reading reaches a minimum length,
  because an instant-answer box pulls people past the waiting the method
  depends on.
- LLM providers: symbol extraction always runs on native Gemini
  (`GEMINI_MODEL`, flash-lite — quota measured healthy in a real 25-request
  test). The expansion call routes through `SYNTHESIS_PROVIDER`; it is set
  to Groq (`qwen/qwen3.6-27b`) in both local and live environments, because
  Gemini's flash tier repeatedly failed with 429/503. A stronger-looking
  Groq alternative (`gpt-oss-120b`) was deliberately rejected for a
  documented over-refusal pattern specifically on psychological-analysis
  content, which conflicts with the kind of sensitive material real dream
  work routinely surfaces.

## Brand Commitments

Name: **Sembol Çarkı**. Explicitly and durably grounded in Robert Johnson's
*Inner Work* — the four-step structure and the "personal association
before cultural amplification" priority are the product's actual
mechanism, not decorative brand flavor. A redesign may not simplify these
away.

## Evidence on Hand

Six real dream records exist in `ruyalar/` from live personal use. They
are private material and are explicitly gitignored. **None of these real records may ever be used,
quoted, or paraphrased as example/demo content** in mockups, screenshots,
onboarding copy, or documentation. Any example dream/symbol content needed
for new design work must be fabricated placeholder content.

## Product Principles

- Kişisel çağrışım her zaman mitolojik/kültürel bilgiden önce gelir —
  bu ilke UI'ın hangi bilgiyi önce gösterdiğini de belirlemeli.
- Uygulama bir "oracle" değil bir "araç"tır: yapay zeka kullanıcının kendi
  yorumlama işinin yerine geçmemeli.
- Görsel harita, kullanıcının kendi çalışmasını kaybetmeden sürdürmesini
  sağlayan ana taşıyıcı unsurdur — sıradan bir "sonuç grafiği" değil.
- Kalıcı depolamaya güvenilmez; kullanıcı her zaman kendi kopyasını
  alabilmelidir.
- Johnson'ın dört adımının bütünlüğü korunmalı, yöntemi kısaltan/atlayan
  kısayollar eklenmemeli.
- Araç boşluk doldurmaz, boşluk açar: kullanıcının dolduracağı yapılandırılmış
  alanlar sunmak asıl iş, o alanları yapay zekanın doldurması değil.
- Modülerlik: geri dönüp düzenleme özelliği eklemek yerine (2026-09-13,
  Kaan'ın kararı) kilit baştan görünür yapılır — yorum kaydedilmeden/
  genişletilmeden hemen önce, bundan sonra sembollere/çarka dönülemeyeceğini
  söyleyen açık bir onay istenir (bkz. PLAN.md, `finalize.lockConfirm`).
