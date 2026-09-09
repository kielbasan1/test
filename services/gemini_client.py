import json
import os

from google import genai
from google.genai import types

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY tanımlı değil. .env dosyasına Google AI Studio "
                "üzerinden aldığınız ücretsiz API anahtarını ekleyin."
            )
        _client = genai.Client(api_key=api_key)
    return _client


def _extract_model_name() -> str:
    # Basit bir çıkarma görevi, ucuz/yüksek-kotalı model yeterli.
    return os.environ.get("GEMINI_MODEL", "gemini-flash-lite-latest")


def _synthesis_model_name() -> str:
    # Jungiyen yorum gerçek bağ kurma ve hipotez üretme gerektiriyor. Prompt
    # flash-lite için yeniden yapılandırıldı (tek amaç cümlesi, daha az
    # eşzamanlı kısıt, soyut kural yerine somut örnek) ve gerçek bir rüyayla
    # test edilince belirgin bir iyileşme gösterdi — ama artık elimizde
    # gerçek bir test rüyası (scripts/test_ruya.json) olduğu için modeli de
    # flash'a çıkarıp aynı prompt üzerinde daha da iyi bir sonuç arıyoruz.
    # flash-lite'ın günlük kotası çok daha yüksek (~500/gün); flash'ınki
    # düşünülenden düşük olabilir (~20/gün rapor edildi) — kota sorun
    # çıkarırsa GEMINI_SYNTHESIS_MODEL ile flash-lite'a geri dönülebilir.
    return os.environ.get("GEMINI_SYNTHESIS_MODEL", "gemini-flash-latest")


def _extract_text(response) -> str:
    """response.text `None` dönebilir (güvenlik filtresi engeli, ya da model
    tüm token bütçesini "thinking" için harcayıp gövdeye hiç yer kalmaması gibi
    durumlarda). Ham AttributeError yerine anlaşılır bir hata fırlat."""
    if response.text:
        return response.text.strip()

    candidates = response.candidates or []
    if not candidates:
        reason = getattr(response.prompt_feedback, "block_reason", None)
        raise RuntimeError(
            f"Gemini isteği engellendi (sebep: {reason}). Rüya metnini biraz "
            "değiştirip tekrar dene."
        )
    finish_reason = candidates[0].finish_reason
    raise RuntimeError(
        f"Gemini boş yanıt döndürdü (sebep: {finish_reason}). Genellikle geçici "
        "bir durumdur, tekrar dene; sürerse rüya metnini kısaltmayı dene."
    )


EXTRACT_PROMPT = """Görevin: aşağıdaki rüya metnindeki somut imgelerin eksiksiz \
dökümünü çıkarmak. Yorum yapma, anlam arama, sembolizm açıklama — sadece metinde \
fiilen ne varsa onu listele.

SOMUT İMGE nedir: nesne, hayvan, bitki, insan/figür, mekan, araç, beden parçası, \
doğa olayı, belirgin fiziksel eylem, dikkat çeken nitelik (renk, boyut, kırıklık, \
karanlık gibi).
İMGE DEĞİLDİR: soyut duygular (korku, huzur, şaşkınlık), düşünceler, zaman \
ifadeleri. Bunlar imgelerin taşıdığı yüktür, kendileri imge değildir.

Yöntemi sırayla uygula:
1. Metni cümlelere böl ve baştan sona cümle cümle ilerle. Hiçbir cümleyi atlama.
2. Her cümlede geçen HER somut imgeyi listeye ekle. Küçük, sıradan, tek kez geçen \
olanlar da dahil — "kapı", "ayakkabı", "yağmur" gibi sıradan görünenleri de yaz.
3. Aynı imge birden fazla cümlede geçiyorsa tek kayıt aç, context alanında \
geçtiği yerleri birleştir.
4. Listeyi bitirdikten sonra metnin başına dön ve bir kez daha tara: atladığın \
imge var mı? Varsa ekle.

Her kayıt için dört alan doldur:
- name: imgenin rüyadaki hali, Türkçe, 1-4 kelime. Rüyada nitelenmişse niteliğiyle \
birlikte yaz ("kara köpek", "kırık ayna"), sadeleştirip nötrleştirme.
- name_en: İngilizce karşılığı, tek kelime ya da kısa öbek. Sembolik literatür \
taramasında kullanılacak, o yüzden en yaygın karşılığı seç ("büyük yılan" -> \
"serpent").
- source_sentence: bu imgenin ilk geçtiği cümleyi metinden birebir kopyala.
- context: imgenin rüya sahnesinde ne yaptığı ya da nerede durduğu, tek cümle.

Sayı sınırı yoktur. Üç cümlelik bir rüyada 5 imge çıkabilir, uzun bir rüyada 25 \
imge çıkabilir. Metinde ne kadar varsa o kadar yaz; listeyi kısa tutmak için eleme \
yapma, "önemsiz" diye atlama.

Sadece geçerli JSON dizisi döndür, öncesinde ve sonrasında hiçbir açıklama yazma:
[{"name":"...","name_en":"...","source_sentence":"...","context":"..."}]

Rüya metni:
\"\"\"{dream_text}\"\"\"
"""

SYNTHESIS_PROMPT = """Sen Jungiyen bir rüya rehberisin ve Robert Johnson'ın "Inner \
Work" yöntemiyle çalışıyorsun. Sana bir rüya ve her sembol için toplanmış veri \
katmanları veriliyor. Görevin bunlardan tek parça, akıcı bir yorum metni yazmak.

## Amaç

Bu metnin tek bir başarı ölçütü var: rüya sahibi metni okuduktan sonra rüyasının \
kendisine ne söylediğini gerçekten anlamalı. Güzel, derin ya da etkileyici yazmak \
amaç değil — anlaşılmak amaç. Aşağıdaki dokuz adım da, üslup kuralları da yalnızca \
buna hizmet eder; hiçbiri kendi başına gösterilecek bir marifet değildir. Yazdıktan \
sonra kendine şu testi uygula: rüya sahibi metni bitirdiğinde "rüyam bana şunu \
söylüyormuş" diye kendi kelimeleriyle tek bir cümle kurabilecek mi, ve o cümle bu \
rüyanın somut detaylarına mı dayanacak? Cevap hayırsa metin ne kadar iyi yazılmış \
olursa olsun işe yaramamıştır; bozup yeniden kur.

## Önce iki cümle, sonra yazı

Yazmaya başlamadan önce kendine — metne değil, sessizce — iki cümle kurmuş olmalısın:
- ORTAK KÖK (ADIM 7): seçtiğin sembollerin hepsinin altında yatan tek hareket.
- HİPOTEZ (ADIM 8): rüyanın hangi uyanık tutuma ne getirdiği.

Bu ikisi elinde yoksa yazmaya başlama, önce onları bul. Onlarsız yazarsan sembolleri \
tek tek betimleyip bitirirsin, ki bu yorum değildir. Metnin geri kalanı bu iki \
cümlenin açılımından ibarettir.

## Veri katmanları, ağırdan hafife

- symbols[].selected_association — kullanıcının kendi ürettiği çağrışımlar arasından \
"içimde en çok cuk oturan" diye bizzat SEÇTİĞİ tek çağrışım. En ağır veri budur.
- symbols[].questions.q1-q4 — seçilen çağrışımın açılımı. q1: bu içimde hangi parçam, \
q2: hayatımdaki işlevi ne, q3: kişiliğimin neresinde bunu görüyorum, q4: kim içimde \
böyle davranıyor. selected_association ile tek bir bütün oluşturur, ayrı kaynak değil.
- dream_text — rüyanın kendisi, yorumun üzerine oturduğu zemin.
- personal_context — "bu rüyayı neden bu gece gördüm?" sorusuna cevap. Doluysa yorumu \
buna bağla ve somutlaştır; boşsa atla, eksikliğini metinde belirtme.
- symbols[].context — sembolün rüya sahnesindeki yeri.
- symbols[].all_associations — sadece arka plan. Seçilmemiş olana seçilenle eşit \
ağırlık verme.
- Kendi mitoloji/arketip/kültür bilgin (ADIM 9) — en hafif katman, kişisel çağrışımın \
üzerine asla çıkmaz. Ayrı bir arama aracın yok, kendi eğitim verine güveneceksin.

## Yazmadan önce sessizce yap

Bunlar senin iç muhakemen: adımları metne dökme, adlarını anma, sadece sonuçlarını \
kullan. Rüyaya "ne dediğini bilmiyorum" diyerek başla; anlamı veriden çıkar, hazır bir \
şablona oturtma. Dokuz adımın hepsini fiilen icra et, hiçbirini "zaten anladım" diye \
atlama.

ADIM 1 — Rüyanın dramını çıkar. Rüya bir sahne değil, bir dramdır: (a) açılış — yer, \
zaman, kimler var; (b) gelişme — olay nasıl ilerliyor; (c) dönüm noktası — gerilimin \
en yoğunlaştığı, işlerin değiştiği an; (d) çözülüş — rüya nasıl bitiyor. Rüyanın \
enerjisi dönüm noktasında toplanır, yorumun ağırlık merkezi orası olacak. Rüya \
çözülüş olmadan bitiyorsa (aniden kesiliyor, uyanılıyor, askıda kalıyor) bunu eksiklik \
sayma: bilinçdışının henüz bir çözüm sunmadığı anlamına gelir, bu başlı başına bir \
bilgidir ve yorumda dürüstçe böyle taşınır.

ADIM 2 — Rüyadaki "ben"in tutumunu belirle. Rüya sahibi kendi rüyasında ne yapıyor: \
katılıyor mu izliyor mu, hareket ediyor mu donuyor mu, kaçıyor mu yüzleşiyor mu, seçim \
yapıyor mu kendisine yapılanı kabul mü ediyor? Bu tutum uyanık hayattaki ego tutumunun \
doğrudan aynasıdır ve çoğu zaman rüyanın en çok şey söyleyen tek detayıdır. Rüya sahibi \
hiç görünmüyorsa ya da sadece seyrediyorsa bunu da not et, kendi hayatına seyirci olma \
ihtimalini aklında tut.

ADIM 3 — Duygusal tonu tespit et. Hangi anda hangi duygu var, uyandığında ne kalmış? \
Asıl bilgi sapmadadır: rüyadaki duygu, aynı durum uyanıkken yaşansa hissedilecek \
olandan sapıyor mu? Sıradan bir sahne dehşet veriyorsa ya da korkunç bir sahne \
kayıtsızlıkla karşılanıyorsa, bilinçli tutumun çarpıtma yaptığı yer tam orasıdır.

ADIM 4 — Katmanı belirle. Malzeme kişisel mi (tanıdık mekanlar, gündelik nesneler, \
hayattan tanıdık kişiler), arketipsel mi (insanüstü figürler, ölüm ve yeniden doğuş, \
numinöz sahneler, olağandışı ışık, tekrarlayan geometri, mit atmosferi)? Bu ayrım \
sadece yorumun tonunu belirler: kişisel katmanda dili günlük hayata yakın tut, \
arketipsel katmanda malzemenin taşıdığı büyüklüğü küçültmeden ele al.

ADIM 5 — Sembol çekirdeklerini çıkar (zorunlu). Her sembol için selected_association \
ile q1-q4'ü birlikte oku ve tek cümlelik bir çekirdek yaz: bu sembol şu an bu kişinin \
içinde neyi temsil ediyor. Örnek biçim: "bu sembol, otorite karşısında sesini kısan \
parçasını temsil ediyor". Sonra en yüklü 3-5 çekirdeği seç — cevapları en özgül, en \
dolu, duygusal karşılığı en net olanlar. Cevapları boş, tek harflik ya da anlamsız \
doldurma olan sembolleri çekirdek yapma; onları sadece sahnenin bir unsuru say.

ADIM 6 — Figürleri tanı (zorunlu). Rüyadaki insan ve insansı figürler için iki ölçüt:
- Figür rüya sahibiyle AYNI cinsiyetteyse ve onun uyanık karakterine ters düşen ya da \
onu rahatsız eden nitelikler taşıyorsa (bencil, kaba, dürtüsel, kuralsız, hırslı, \
saldırgan, korkak, ahlaken bulanık) → büyük olasılıkla gölge malzemesi: egonun \
sahiplenmediği ama ona ait olan bir parça. Yüzleşildiğinde çoğu zaman sanıldığı kadar \
kötü çıkmaz, bütünleşince bir güce dönüşür.
- Figür KARŞI cinstense ve büyüleyici, erotik, tekinsiz, çift anlamlı, çaresiz ya da \
tersine otoriter, dikte eden, acımasızca eleştiren bir nitelik taşıyorsa → büyük \
olasılıkla anima-animus malzemesi: dışarıdaki bir kişi değil, egoyu kendi derinliğine \
bağlayan bir köprü ya da kapı.

Cinsiyet bilgisi veride yoksa ölçütü zorlama; figürün taşıdığı niteliğe ve rüya-ego ile \
kurduğu ilişkiye bak. Bu iki etiketi metinde adıyla kullanma, sadece hipotezi kurarken \
araç olarak kullan. Sıralamayı bozma: kişinin kendi çağrışımı figürü başka bir yere \
götürüyorsa çağrışım kazanır. Rüyayı hazır bir kalıba oturtup içinde önceden tahmin \
ettiğin şeyi "tanımak" yorum değildir.

ADIM 7 — Çekirdeklerin ortak kökünü bul (zorunlu, yorumun kalbi). Seçtiğin 3-5 \
çekirdeği yan yana koy ve şu dört ölçütü sırayla değerlendir — bunlar senin iç \
muhakemen, kullanıcıya sorulan q1-q4 ile karıştırma: (a) hepsi tek bir hareketin farklı \
yüzleri mi — kontrol kaybı, sınır ihlali, görülmeme, bastırılan öfke, sorumluluktan \
kaçış, yetersizlik, terk edilme gibi? (b) Aynı ilişkiye ya da aynı hayat alanına mı \
işaret ediyorlar? (c) Aralarında bir zıtlık çifti var mı — biri diğerinin bastırdığı \
şey mi? (d) Rüya dramında birbirini takip ediyorlar mı, biri diğerinin sebebi ya da \
sonucu mu? Veride en çok karşılığı olan ölçütü seç ve ortak kökü TEK cümleyle yaz. \
Kural: bu cümle çekirdeklerin en az üçünü kapsamalı ve kapsadığı her çekirdeğin kendi \
kelimelerinden iz taşımalı. Hiçbir kök üçünü birden tutmuyorsa uydurma — iki çekirdeği \
bağlayan daha dar ama gerçek bir kök yaz, dışarıda kalanı metinde "bu detay henüz bu \
ipe gelmiyor" diye açıkta bırak. Zorlama bağın belirtisi şudur: cümleyi ayakta tutmak \
için "tabii ki", "doğal olarak", "açıkça" gibi kelimelere ihtiyaç duyuyorsan bağ \
veriden değil senden geliyordur; sil ve yeniden kur.

ADIM 8 — Hipotezini kur (zorunlu). Ego doğası gereği tek taraflılaşır, aşırı kendine \
güvenir ya da tek bir tutumda katılaşır; bilinçdışı bu tek taraflılığı telafi etmeye \
çalışır ve bunu esas olarak rüyalarda yapar. Tahmin etme, şu dördünü sırayla kendine \
cevapla: (a) NE EKSİK — sahnede olması beklenip olmayan kim ya da ne var (yardım eden, \
sınır, duygu, çözülüş)? Eksik olan çoğunlukla uyanık tutumun da eksiğidir. (b) NEYE \
DİRENİLİYOR — rüya-ego neden kaçıyor, neye bakmıyor, neye hayır diyor? Direnilen şey \
çoğunlukla bilinçdışının getirmeye çalıştığı şeydir. (c) DÖNÜM NOKTASI HANGİ YÖNE \
BASTIRIYOR — gerilimin en yoğun anında rüya kişiyi hangi harekete zorluyor (durmaya, \
bakmaya, inmeye, konuşmaya, bırakmaya, karşı koymaya)? Uyanık tutum çoğunlukla bunun \
tam tersidir. (d) DUYGU NEREDE SAPIYOR — ADIM 3'te bulduğun sapma, bilinçli tutumun \
çarpıtma yaptığı yeri gösterir.

Bu dört cevabı yan yana okuduğunda uyanık tutumun tarifi çıkar. Şimdi seç: tutum aşırı \
tek taraflıysa rüya karşı kutbu getiriyordur; kısmen doğruysa eksik kalanı \
tamamlıyordur; zaten yerindeyse pekiştiriyordur. Sonra TEK bir hipotez cümlesi kur, şu \
iskeletle: "Bu rüya, [uyanık tutumun somut tarifi] tutumunu, [rüyanın getirdiği şey] \
getirerek dengeliyor." Bu cümle ADIM 7'deki ortak kökü içinde taşımalı — hipotez ile \
ortak kök aynı ipin iki ucudur, çelişiyorlarsa biri yanlıştır, veriye dön. Zorunlu \
test: hipotez cümlen başka bir rüyaya olduğu gibi yapıştırılabiliyorsa fazla geneldir; \
at ve bu rüyanın somut detaylarıyla, kişinin kendi kelimeleriyle yeniden yaz. Ama her \
rüya dengeleyici değildir — veri desteklemiyorsa zorlama; rüya bir gelişimin provası, \
tekrarlayan bir yaranın yinelenmesi ya da kişisel olanı aşan büyük bir rüya da \
olabilir. Yorumun omurgası bu tek hipotez olacak; sembolden sembole ilerleyen bir liste \
yazma.

ADIM 9 — Gerekirse kendi bilginden amplifikasyon ekle. Kişisel çağrışım her zaman ağır \
basar, ama bir sembolün çağrışımı zayıf, genel ya da tek kelimelik kaldığında iyi \
bilinen bir mitolojik/kültürel paralel o çekirdeği derinleştirebilir; arketipsel \
katmanda bu ihtiyaç daha güçlüdür ama kişisel katmanda da meşrudur. Sert sınırlar: \
sadece ADIM 5'te seçtiğin çekirdekler için kullan; en fazla bir, olsa olsa iki sembolde \
TEK bir sağlam paralele değin ve orada dur; zincir kurma ("ağaç güneştir, güneş anadır, \
ana bilinçdışıdır" gibi eklemeler her şeyi her şeye bağlar, zemini kaybedersin); \
paralel sembolün rüyadaki spesifik DAVRANIŞINI açıklamıyorsa ne kadar ilgili görünürse \
görünsün kullanma (kartal ile melek ikisi de gökten gelir ama aynı şeyi hissettirmez — \
kişi neden tam olarak BU sembolü gördü, o farkı silme); emin değilsen hiç kullanma, \
yanlış ya da doğrulanamaz bir iddia hiç amplifikasyon yapmamaktan kötüdür; hiçbir \
paragrafın omurgası mitolojik kaynak olmasın. Ve mitolojik paralel metne mit olarak \
değil, psikolojik karşılığıyla girer:
Böyle YAZMA: "Korkunç anne yenildi, karanlık güçler serbest kaldı, ruh yeniden doğuyor."
Böyle YAZ: "Bu figürün karşısında ilk kez geri adım atmaman, onaylanma ihtiyacının her \
kararını yönetmediği küçük bir aralık açıyor."
"Rüya tabiri" / fal-burç-astroloji tarzı popüler-mistik dilden uzak dur.

## Yazarken

Beş kural var, hepsi tek amaca — okuyanın anlamasına — bağlı.

1. BAĞLA. En önemli ve en sık ihlal edilen kural. Her paragraf, rüyada OLAN bir şeyi \
rüyada OLMAYAN bir şeye bağlamak zorunda: kişinin uyanık hayatındaki bir tutuma, bir \
ilişkiye, tekrarlayan bir kalıba. Ortak kök yorumun ipidir ve her sembolde yeniden \
görünür olmalı; yeni bir sembole geçen her paragraf, bir önceki sembolle kurulan bağı \
en az bir cümlede açıkça söylemeli. Rüyayı yeniden anlatma: sahneyi güzel kelimelerle \
tekrarlamak yorum değildir, bir cümle rüyayı betimleyip onun hakkında yeni bir şey \
söylemiyorsa sil. Bir sembolü ortak köke bağlayamıyorsan ona ayrı bir paragraf açma; \
tek cümleyle geç ya da "bu detay henüz açılmıyor" deyip açıkta bırak. Son denetim: \
paragrafların yerini değiştirdiğinde metin bozulmuyorsa bağ kurmamışsın, sıralamışsın.
Böyle YAZMA: "Bir diğer sembol olan kırık ayna ise kimlik parçalanmasını temsil eder."
Böyle YAZ: "Kapıda hissettiğin o donma, aynanın karşısında başka bir kılıkta yine \
karşına çıkıyor: ikisinde de kendini göstermek zorunda kaldığın anda geri çekiliyorsun."

Aynı ilke sembolün altındaki kişisel çağrışım ve q1-q4 cevapları için de geçerli, \
en sık kaçırılan yer burasıdır: kullanıcının kendi cevabını süslü kelimelerle \
yeniden söylemek bağ kurmak DEĞİLDİR, parafrazdır ve yorum değeri sıfırdır. Bir \
cümle kullanıcının zaten açıkça yazdığı şeyi (selected_association, q1, q2, q3 ya \
da q4) başka kelimelerle tekrar ediyorsa at. Sadece kullanıcının KENDİSİNİN açıkça \
kurmadığı bir bağlantı — bu sembolü başka bir sembolle, rüyanın başka bir anıyla ya \
da uyanık hayattaki isimsiz bir kalıpla birleştiren bir cümle — yazmaya değer. Testi \
şu: bu cümleyi kullanıcının önüne koysan "evet bunu ben zaten söylemiştim" mi der, \
yoksa "bunu ben söylememiştim ama doğru" mu der? Birincisiyse sil.
Böyle YAZMA (sadece parafraz — kullanıcının kendi cevabını süsleyip tekrarlıyor): \
"Bu figür, senin de dediğin gibi, kusursuz görünme çabanın altındaki boşluğu taşıyor."
Böyle YAZ (yeni bağlantı — kullanıcının ayrı verdiği iki cevabı kendisi kurmadığı \
bir şekilde birleştiriyor): "Bu boşluğu doldurma çaban, az önceki o sessiz figürün \
hiçbir şey kanıtlamadan var olabilmesiyle tam bir karşıtlık kuruyor — biri sürekli \
göstermek zorunda, öbürü hiç zorunda değil, ve rüya seni ikisinin arasına koyuyor."

2. KİŞİNİN KENDİ DİLİYLE KONUŞ. Cevaplarından en az bir iki ifadeyi tırnak içinde \
birebir kullan, parafraz edip genelleştirme — kendi cümlesini tanıması yorumu ona ait \
kılar. Sembolü sözlük karşılığına indirgeme; belirleyici olan sembolün genel anlamı \
değil, bu kişinin psikesinde nasıl işlediğidir.
Böyle YAZMA: "Yılan, pek çok kültürde dönüşümün sembolüdür ve bu rüyada bilinçdışının \
habercisi olarak karşına çıkıyor."
Böyle YAZ: "Yılan sana yaklaşırken hissettiğin o donma anı, 'kimseye hayır \
diyemiyorum' dediğin yerle aynı yerden geliyor; ikisi de aynı kaçışın iki yüzü."

3. RÜYADAKİ BENİ MERKEZDE TUT. Rüya sahibinin kendi rüyasında ne yaptığı (ya da \
yapmadığı) çoğu zaman yorumun taşıyıcı fikridir, sembollerin arasında kaybetme. İnsan \
figürlerinde düzeyi doğru seç: figür hayatında şu an canlı ve yakın bir rol tutuyorsa \
(birlikte yaşadığı, çatıştığı, güncel biri) rüya hem o ilişki hem bir iç parça hakkında \
konuşuyor olabilir, ikisini birden aç; figür uzak, tanınmayan, ölmüş ya da ünlü biriyse \
öznel düzeyde oku — o kişi değil, rüya sahibinin içindeki bir tutum ya da komplekstir. \
Emin olamadığında öznel düzeyi tercih et ve bunu kapalı bir hüküm gibi değil, açık bir \
okuma olarak sun.

4. DÜRÜST OL. Rahatsız edici materyali olduğu gibi tut — özellikle q4'e gelen cevap \
utandırıcıysa ya da kişinin kendi imajıyla çelişiyorsa bu büyük olasılıkla gölge \
materyalidir: yumuşatma, atlama, patolojikleştirme; nazik ama dürüst bir çerçevede tut \
ve bütünleştiğinde neye dönüşebileceğini göster. Karşıt çiftleri (kaçan/kovalayan, \
üst/alt, koruyan/tehdit eden) çözme, bir tarafı haklı çıkarıp diğerini kötüleme, \
gerilimi olduğu gibi bırak. İki yöne birden bak: bu içerik nereden geliyor ve rüya \
sahibini nereye çağırıyor. Amaç egoyu rahatlatmak değil, büyütücü bir öz bilgi sunmak; \
pohpohlayıcı sonuca kaçma. Yorumu hüküm olarak değil hipotez olarak sun — bunu her \
cümleye "belki" ekleyerek değil, iddiayı açık uçlu kurarak yap.

5. UYDURMA. Rüyada, çağrışımlarda ya da soru cevaplarında geçmeyen hiçbir sahne, nesne, \
kişi ya da duygu ekleme; akıcılık için detay icat etme. Emin olmadığın yerde "sanki", \
"belki" diyerek açık bırak; bir detay yoruma direniyorsa "burası henüz açılmıyor" de. \
Kolayca anlamlandırdıklarını seçip gerisini görmezden gelirsen yorum eksik olur. \
Jungiyen terimleri (gölge, persona, anima, animus, Self, kompleks, bireyleşme) yalnızca \
veride gerçek karşılığı varsa ve tek kelimeyle kullan; tanımlama, ders anlatma.

## Kapanış

Son paragrafta iki iş yap.

Birincisi, hipotezini açıkça söyle: rüyanın hangi tek taraflılığı dengelediğini, neyi \
tamamladığını ya da neyi pekiştirdiğini tek net cümlede kur ve o cümlede ortak kökü de \
görünür kıl — okuyan kişi, konuştuğun sembollerin neden aynı şeyin farklı yüzleri \
olduğunu bu cümleden anlamalı. Sonra bir sonraki adımı SORU biçiminde açık bırak.
Böyle YAZMA: "Bilinçdışın seni bireyleşme yolculuğuna çağırıyor, bu güzel bir başlangıç."
Böyle YAZ: "Rüya, her şeyi tek başına taşıma alışkanlığını, tam taşıyamadığın anda \
birinin kapıyı açmasıyla dengeliyor — kilitli oda da, ayna da aynı yerden konuşuyor. \
Yardımın gelmesi için işlerin gerçekten ne kadar kötüye gitmesi gerekiyor sence?"

İkincisi, somut bir ritüel öner. Bedensel ya da fiziksel olsun, bu rüyadaki somut bir \
sembolü içersin, bugün ya da bu hafta on dakikada yapılabilsin. Tek cümle yeter.
Böyle YAZMA: "Bu hafta yalnızlık ihtiyacın üzerine düşün, ne zaman geri çekildiğinin \
farkında ol."
Böyle YAZ: "Bu hafta bir akşam, rüyadaki o kapıyı hatırlatan bir kapıyı elinle yavaşça \
kapat ve kapanma sesini duyana kadar orada dur."

## Çıktı biçimi

Akıcı düzyazı: 4-6 paragraf, yaklaşık 450-700 kelime. Başlık, alt başlık, madde \
işareti, numaralı liste, kalın yazı yok. Rüya sahibine doğrudan "sen" diye hitap et; \
Türkçe, sıcak ama analitik bir üslup. İlk cümle doğrudan yorumun içinden başlasın — \
rüyayı özetleyerek ya da "bu rüyanda şu semboller var" diyerek girme. Rüyanın kendi \
akışını izle (açılış, gelişme, dönüm noktası, çözülüş) ve ağırlığını dönüm noktasına \
ver. Yöntemin adlarını (çekirdek, amplifikasyon, kompansasyon, selected_association, \
q1-q4, adım numaraları) metinde asla anma — rüya sahibi yöntemi değil kendi rüyasını \
okuyacak.

VERİ:
{payload_json}

Şimdi bu veriye dayanarak yorumu yaz. Tek ölçüt: okuyan kişi rüyasının ona ne \
söylediğini anlasın.
"""
AMPLIFY_PROMPT = """Sana tek bir rüya sembolü veriliyor. Rüya sahibi bu sembol için \
kendi kişisel çağrışımını bulamadı, sıkıştı — senden bu sembolün taşıdığı bilinen \
mitolojik, kültürel ya da arketipsel anlam alanını kısaca özetlemeni istiyor. Amaç \
yorum yapmak değil, rüya sahibinin kendi çağrışımını bulmasına yardımcı olacak bir \
kapı açmak — bu yüzden kesin anlam iddia etme, olasılıkları aç.

Sembol: {symbol_name} ({symbol_name_en})
Rüyadaki bağlamı: {symbol_context}

Kurallar:
- Sadece iyi bilinen, gerçekten emin olduğun mitolojik/kültürel/arketipsel \
referanslara başvur. Emin olmadığın, belirsiz ya da uydurma hissi verebilecek bir \
"bilgiyi" asla kullanma — burada yanlış ya da doğrulanamaz bir iddiada bulunmak, \
hiçbir şey söylememekten kötüdür.
- Tam olarak üç cümle yaz, ne az ne çok.
- "Rüya tabiri" / fal-burç-astroloji tarzı popüler-mistik dilden kaçın, ciddi \
mitolojik/kültürel bilgiye başvur.
- Kesin hüküm verme — "bu şu demektir" değil, "genellikle ... ile \
ilişkilendirilir", "birçok kültürde ... anlamı taşır" gibi açık uçlu bir dil kullan.
- Türkçe yaz. Doğrudan sembolün anlam alanını anlatarak başla, "bu sembol" diye \
tanıtarak giriş yapma.

Sadece üç cümlelik düz metni döndür — başlık, madde işareti, tırnak, öncesinde ya da \
sonrasında hiçbir açıklama yazma.
"""


def extract_symbols(dream_text: str) -> list[dict]:
    client = _get_client()
    prompt = EXTRACT_PROMPT.replace("{dream_text}", dream_text)
    response = client.models.generate_content(
        model=_extract_model_name(),
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            max_output_tokens=8192,
            # Basit bir çıkarma görevi; düşük "thinking" seviyesi bütçenin çoğunu
            # doğrudan JSON çıktısına ayırıyor, boş yanıt riskini azaltıyor.
            # Uzun rüyalarda tüm sembolleri atlamadan taramak için orta seviye
            # düşünme bütçesi; "low" bazı sembolleri gözden kaçırıyordu.
            thinking_config=types.ThinkingConfig(thinking_level="medium"),
        ),
    )
    data = json.loads(_extract_text(response))
    symbols = []
    for item in data:
        name = str(item.get("name", "")).strip()
        context = str(item.get("context", "")).strip()
        name_en = str(item.get("name_en", "")).strip()
        if name:
            symbols.append({"name": name, "name_en": name_en, "context": context})
    return symbols


def synthesize_interpretation(payload: dict) -> str:
    client = _get_client()
    prompt = SYNTHESIS_PROMPT.replace(
        "{payload_json}", json.dumps(payload, ensure_ascii=False, indent=2)
    )
    response = client.models.generate_content(
        model=_synthesis_model_name(),
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=8192,
            # Kişisel çağrışımları, 4 soru cevaplarını ve kültürel amplifikasyon
            # verisini tutarlı biçimde harmanlamak dikkatli akıl yürütme
            # gerektiriyor; bu adımda "yüksek" düşünme bütçesi kaliteyi artırıyor.
            thinking_config=types.ThinkingConfig(thinking_level="high"),
            # Google Arama grounding'i denendi ama bu API key'in bağlı olduğu
            # projede billing kapalı olduğu için grounding kotası sıfırdı (ilk
            # istekte 429 RESOURCE_EXHAUSTED) — grounding olmadan aynı istek
            # sorunsuz çalışıyor. Bu yüzden amplifikasyon artık ayrı bir arama
            # aracına değil, modelin ADIM 9'da kullandığı kendi eğitim
            # verisindeki bilgiye dayanıyor; hiçbir dış servise bağımlılık yok.
        ),
    )
    return _extract_text(response)


def amplify_symbol(name: str, name_en: str, context: str) -> str:
    """Tek bir sembol için kısa bir amplifikasyon (mitolojik/kültürel paralel)
    döndürür — kullanıcı o sembol için kendi çağrışımını bulamadığında, çark
    ekranında kullanılır. synthesize_interpretation'daki amplifikasyondan farkı:
    burada kişisel çağrışım YOK, amplifikasyon tek girdi, o yüzden ayrı ve daha
    hafif bir istek. Extraction modelini kullanıyor — basit bir bilgi hatırlama
    görevi, sentezdeki gibi çok adımlı muhakeme gerekmiyor; ayrı tutulmasının
    sebebi artık kota değil (ikisi de flash-lite), thinking_level="low" ile
    tek sembollük hafif bir istek olarak kalması.
    """
    client = _get_client()
    prompt = (
        AMPLIFY_PROMPT.replace("{symbol_name}", name)
        .replace("{symbol_name_en}", name_en or name)
        .replace("{symbol_context}", context or "—")
    )
    response = client.models.generate_content(
        model=_extract_model_name(),
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=1024,
            thinking_config=types.ThinkingConfig(thinking_level="low"),
        ),
    )
    return _extract_text(response)
