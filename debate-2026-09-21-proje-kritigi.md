# Six Hats: Jung Yapay Zeka Projesi — Genel Kritik (Karsinizasyon Prensibiyle)

**Tarih**: 2026-09-21
**Şapkalar**: Beyaz → Sarı → Siyah → Yeşil · **Tur**: 1 · **Mod**: AI oto-analiz

## Açılış (Mavi Şapka)
Projenin genel durumunu Kaan'ın karsinizasyon/less-is-more/Pareto prensibiyle (önce
gövde/çekirdek neyse onu bul, enerjinin %90'ı oraya, çevre kesilir) süzmek amacıyla
Beyaz→Sarı→Siyah→Yeşil sırasıyla, tek turda, ben analiz ederek ilerledim — teknik/proje
değerlendirmesi olduğu için Kırmızı Şapka'ya gerek görmedim.

## Round 1

### Beyaz Şapka — _AI_
- **Doğrulanmış (koddan okundu):** Gövde akışı çalışıyor — `extract_symbols` (Gemini,
  mekanik imge çıkarımı) → kullanıcı kendi çağrışımını/4 soruyu/kendi yorumunu yazıyor →
  isteğe bağlı `expand_interpretation` (kör nokta, kullanıcı yorumu zorunlu girdi) →
  isteğe bağlı `amplify_symbol` (sıkışan sembol için 3 cümlelik mitoloji). AI hiçbir
  adımda birincil yorumcu değil.
- **Doğrulanmış:** Eski "SYNTHESIS_PROMPT" (birincil yorum üreten) artık kodda yok —
  yerini tamamen `EXPAND_PROMPT` (kör nokta bulma) almış. Concept notundaki "sadeleştirme"
  kaydından daha büyük bir değişim: sadeleşme değil, rolün tersine çevrilmesi.
- **Doğrulanmadı ama muhtemel (concept dosyasından):** Ritual adımı (Johnson'ın 4.'sü)
  hiç kodlanmamış — PLAN.md'de iki kez ("Faz 1.2 yeniden açıldı") gündeme gelmiş,
  hiçbiri kapanmamış.
- **Doğrulanmış (dosya boyutu):** `PLAN.md` 49KB / ~24 başlık, 3 ayrı `debate-*.md`
  (12K+9K+4K), `PRODUCT.md` 23KB hâlâ commit edilmemiş.

### Sarı Şapka — _AI_
Karsinizasyon merceğiyle bakınca projenin "solar pleksus"u tema, arşiv özelliği ya da
PWA değil — **yöntem tersine çevirmesi**: kullanıcı önce kendi elinden geçiriyor, AI
sadece mekanik (extract) ya da istek üzerine ikincil (expand/amplify) devreye giriyor.
Bu zaten Pareto'ya uygun kurulmuş: iki pahalı LLM çağrısından biri hep ucuz/basit
(extract), diğeri opsiyonel ve tek amaçlı (expand — "parafraz etme, not verme, imgede
kal, gerilimi çözme, uydurma" 5 kuralı zaten sıkı). Bu gövde sağlam, dokunmaya gerek yok.

### Siyah Şapka — _AI_
Risk kodda değil, kodun etrafında yığılan belge kütlesinde. Emsal: SYNTHESIS_PROMPT'ın
22.500→4.937 karaktere inmesi ve six-hats-v2'nin silinmesi, ikisi de "araştırma/plan
hacmi arttıkça sadeleştirme sinyali güçlenir" kuralını doğruladı — bu proje şu an tam
o birikme evresinde:
- PLAN.md'de aynı faz iki kez açılmış (Faz 1.2), alt-fazlar türemiş (3.4/3.6/3.7) —
  hangisi güncel belirsizleşiyor.
- PRODUCT.md commit edilmeden bekliyor: hem yedeksiz kalma riski hem de "ürün ne"
  tanımının resmi olmayan bir dosyada asılı kalması.
- "Karar verildi ama uygulanmadı" listesi büyüyor: Gece Rasathanesi teması, beş kodlama
  maddesi ("tamamlandı ama commit'lenmedi, hiç test edilmedi").
- Ritual'ın kodlanmaması PLAN.md'de hâlâ açık bir madde gibi duruyor — ama
  `Kurallar.md`'de zaten net bir karar var: "ritüeli Kaan kendi başına geliştirir,
  uygulamaya girmez." Plan bu kararı yansıtmıyor, kendi kendiyle çelişiyor.

### Yeşil Şapka — _AI_
**PO: PLAN.md ve üç debate dosyası bu hafta silinsin, geriye sadece kod + tek sayfalık
"şu an ne yapılıyor" kalsın.**
→ Kaybedilen şey aslında hiçbir şey değil — geçmiş kararların "neden"i zaten git log'da
ve `knowledge/concepts/jung-yapay-zeka-projesi.md`'de duruyor. Gövde PLAN.md değil, kod
ve alınmış kararlar. Hareket değeri: tamamlanmış fazları arşivle/sil, PLAN.md'yi sadece
aktif faza indir.

**PO: Ritual adımı asla kodlanmasın.**
→ Bu kışkırtma aslında zaten alınmış bir kararı doğruluyor (Kurallar.md). "Eksik"
göründüğü yer, bilerek gövdenin dışında bırakılmış bir sınır — PLAN.md'nin bunu hâlâ
açık madde gibi taşıması, plan-karar tutarsızlığının kendisi.

## Kapanış (Mavi Şapka)
Kodun gövdesi sağlam ve zaten bir kez Pareto'dan geçmiş; risk tamamen çevrede —
plan/tartışma/karar belgelerinin kendi ağırlığı altında büyümesinde. Ritual'ın
kodlanmaması bir eksik değil, muhtemelen unutulmuş bir plan maddesiyle çelişen
zaten-alınmış bir karar.

Somut sonraki adım: PLAN.md'yi "aktif faz" (tek sayfa) ve "tarihsel" (arşive/concept
dosyasına taşı) diye ikiye ayırmak, üç debate dosyasını tek karar özetine indirmek,
PRODUCT.md'yi commit etmek (kişisel kısmı ayrı private dosyaya alarak).
