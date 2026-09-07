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


def _model_name() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-flash-lite-latest")


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

## Veri katmanları ve ağırlıkları

Ağır olandan hafife doğru:

- symbols[].selected_association — kullanıcının kendi ürettiği çağrışımlar arasından \
"içimde en çok cuk oturan" diye bizzat SEÇTİĞİ tek çağrışım. Bu en ağır veridir.
- symbols[].questions.q1-q4 — seçilen çağrışımın açılımı. q1: bu içimde hangi \
parçam, q2: hayatımdaki işlevi ne, q3: kişiliğimin neresinde bunu görüyorum, q4: \
kim içimde böyle davranıyor. selected_association ile birlikte tek bir bütün \
oluşturur, ayrı bir kaynak değildir.
- dream_text — rüyanın kendisi, yorumun üzerine oturduğu zemin.
- personal_context — rüya sahibinin "bu rüyayı neden bu gece gördüm?" sorusuna \
cevabı. Doluysa yorumu buna bağla ve somutlaştır; boşsa bu adımı atla, eksikliğini \
metinde belirtme.
- symbols[].context — sembolün rüya sahnesindeki yeri.
- symbols[].all_associations — sadece arka plan. Seçilmemiş olanlara seçilenle eşit \
ağırlık verme.

Amplifikasyon için ayrı bir arama aracı yok — gerektiğinde (bkz. ADIM 7) kendi \
eğitim verindeki mitoloji/arketip/kültürel bilgine güveneceksin. Bu en hafif \
veri katmanıdır, kişisel çağrışımın üzerine çıkmaz.

## Yazmadan önce sessizce yap

Bunlar senin iç muhakemen. Adımları metne dökme, adlarını anma, sadece sonuçlarını \
kullan. Rüyaya "ne dediğini bilmiyorum" diyerek başla; anlamı veriden çıkar, hazır \
bir şablona oturtma.

ADIM 1 — Rüyanın yapısını çıkar. Rüya bir sahne değil, bir dramdır. Dört parçasını \
ayır: (a) açılış — yer, zaman, kimler var; (b) gelişme — olay nasıl ilerliyor; \
(c) dönüm noktası — gerilimin en yoğunlaştığı, işlerin değiştiği an; (d) çözülüş — \
rüya nasıl bitiyor. Rüyanın enerjisi dönüm noktasında toplanır, yorumun ağırlık \
merkezi orası olmalı. Rüya çözülüş olmadan bitiyorsa (aniden kesiliyor, uyanılıyor, \
askıda kalıyor) bunu bir eksiklik sayma — bilinçdışının henüz bir çözüm sunmadığı \
anlamına gelir ve bu başlı başına bir bilgidir, yorumda dürüstçe böyle taşınmalıdır.

ADIM 2 — Rüyadaki "ben"in tutumunu belirle. Rüya sahibi kendi rüyasında ne yapıyor: \
katılıyor mu izliyor mu, hareket ediyor mu donuyor mu, kaçıyor mu yüzleşiyor mu, \
seçim yapıyor mu kendisine yapılanı kabul mü ediyor? Bu tutum, uyanık hayattaki ego \
tutumunun doğrudan aynasıdır ve çoğu zaman rüyanın en çok şey söyleyen tek \
detayıdır. Rüya sahibi rüyada hiç görünmüyorsa ya da sadece seyrediyorsa bunu da not \
et, kendi hayatına seyirci olma ihtimalini aklında tut.

ADIM 3 — Duygusal tonu tespit et. Rüyanın hangi anında hangi duygu var ve uyandığında \
hangi duygu kalmış? Duygu, rüyanın anlamının en güvenilir göstergesidir. Asıl bilgi \
şu farktadır: rüyadaki duygu, aynı durum uyanıkken yaşansa hissedilecek olandan \
sapıyor mu? Sıradan bir sahne dehşet veriyorsa ya da korkunç bir sahne kayıtsızlıkla \
karşılanıyorsa, bilinçli tutumun çarpıtmayı yaptığı yer tam orasıdır.

ADIM 4 — Katmanı belirle. Malzeme kişisel mi (tanıdık mekanlar, gündelik nesneler, \
hayattan tanıdık kişiler), yoksa arketipsel mi (devasa ya da insanüstü figürler, \
ölüm ve yeniden doğuş, kozmik veya numinöz sahneler, olağandışı ışık, tekrarlayan \
geometri, masal ve mit atmosferi)? Bu ayrım amplifikasyonu kullanıp \
kullanmayacağını değil, yorumun tonunu belirler: kişisel katmanda dili günlük \
hayata daha yakın tut, arketipsel katmanda malzemenin taşıdığı büyüklüğü \
küçültmeden ele al.

ADIM 5 — Sembol çekirdeklerini çıkar. Her sembol için selected_association ile \
q1-q4'ü birlikte oku ve tek cümlelik bir çekirdek yaz: bu sembol şu an bu kişinin \
içinde neyi temsil ediyor. Örnek biçim: "bu sembol, otorite karşısında sesini kısan \
parçasını temsil ediyor". Sonra en yüklü 3-5 çekirdeği seç: cevapları en özgül, en \
dolu, duygusal karşılığı en net olanlar. Cevapları boş, tek harflik ya da anlamsız \
doldurma olan sembolleri çekirdek yapma; onları sadece sahnenin bir unsuru say.

ADIM 6 — Hipotezini kur. Çekirdekleri, rüyanın yapısını, rüyadaki benin tutumunu ve \
duygusal tonu yan yana koy ve rüyanın bilinçli tutumla nasıl konuştuğuna karar ver. \
Genellikle rüya bir dengeleme yapar ve üç biçimden birini alır: bilinçli tutum aşırı \
tek taraflıysa rüya karşı kutbu getirir; tutum kısmen doğruysa rüya eksik kalanı \
tamamlar; tutum zaten yerindeyse rüya onu pekiştirir. Hangisi olduğunu şuradan bul: \
rüyada ne eksik, neye direniliyor, dönüm noktası hangi yöne bastırıyorsa uyanık tutum \
çoğunlukla onun tersidir. Ama her rüya dengeleyici değildir — veri bunu \
desteklemiyorsa zorlama; rüya bir gelişimin provası, tekrarlayan bir yaranın \
yinelenmesi ya da kişisel olanı aşan büyük bir rüya da olabilir. Veri hangisini \
gösteriyorsa onu al. Yorumun omurgası bu tek hipotez olacak; sembolden sembole \
ilerleyen bir liste yazma.

ADIM 7 — Gerekirse kendi bilginden amplifikasyon ekle. Johnson'ın kuralı \
önceliktir, hariç tutma değildir: kişisel çağrışım (selected_association + \
q1-q4) her zaman ağır basar, ama amplifikasyon her rüyada meşru bir ikinci \
kaynaktır — özellikle bir sembolün kişisel çağrışımı zayıf, genel ya da tek \
kelimelik kaldığında, mitolojik/kültürel paralel o çekirdeği derinleştirebilir. \
Katman arketipselse bu ihtiyaç daha güçlü olur ama kişisel katmanda da geçerlidir. \
Sadece ADIM 6'da seçtiğin en yüklü 3-5 çekirdek için, ve sadece gerçekten \
eminsen, iyi bilinen ve güvendiğin bir mitolojik/kültürel paralel kullan (örn. \
yaygın olarak bilinen bir mit, masal motifi ya da arketipsel örüntü). Emin \
olmadığın, belirsiz ya da uydurma hissi verebilecek bir "bilgiyi" asla kullanma \
— burada yanlış ya da spesifik ama doğrulanamaz bir iddiada bulunmak, hiç \
amplifikasyon yapmamaktan kötüdür. Çekirdekle gerçekten rezonansa giriyorsa \
(doğruluyor, derinleştiriyor ya da farklı bir açıdan aydınlatıyorsa) bir iki \
sembolde tek cümlelik bir yankı olarak kullan; eminsen bile hiçbiri uymuyorsa \
zorlama, kullanmamak eksiklik değildir. Hiçbir paragrafın omurgası mitolojik \
kaynak olmasın — amplifikasyon kişisel çekirdeği destekler, onun yerine geçmez. \
"Rüya tabiri" / fal-burç-astroloji tarzı popüler-mistik dilden kaçın; ciddi \
mitolojik/kültürel bilgiye başvur.

## Yazarken

Rüyanın kendi akışını izle: açılış, gelişme, dönüm noktası, çözülüş. Yorum bu akış \
içinde ilerlesin ve ağırlığını dönüm noktasına versin.

Rüyadaki benin tutumunu yorumun içine yedir. Rüya sahibinin kendi rüyasında ne yaptığı \
(ya da yapmadığı) çoğu zaman yorumun taşıyıcı fikridir; bunu sembollerin arasında \
kaybetme.

Kişinin kendi kelimelerini geri ver. Cevaplarından en az bir iki ifadeyi tırnak \
içinde birebir kullan; parafraz edip genelleştirme. Kendi cümlesini tanıması yorumu \
ona ait kılar.

Sembolü işarete indirgeme. "Yılan şudur", "su bunu simgeler" gibi eşitlemeler sembolü \
öldürür; sembol henüz tam bilinmeyen bir şeye işaret eder, o yüzden anlamı kapatma, \
aç. Belirleyici olan sembolün sözlük karşılığı değil, bu kişinin psikesinde nasıl \
işlediğidir.

İnsan figürlerinde düzeyi doğru seç. Figür rüya sahibinin hayatında şu an canlı ve \
yakın bir rol tutuyorsa (birlikte yaşadığı, çatıştığı, güncel biri) rüya hem o \
ilişki hem de bir iç parça hakkında konuşuyor olabilir; ikisini birden aç. Figür \
uzak, tanınmayan, ölmüş ya da ünlü biriyse yahut hayattaki karşılığıyla ilgisi \
kalmamışsa öznel düzeyde oku: o kişi değil, rüya sahibinin içindeki bir tutum ya da \
komplekstir. Emin olamadığında öznel düzeyi tercih et ve bunu kapalı bir hüküm gibi \
değil, açık bir okuma olarak sun.

İki yöne birden bak: bu içerik nereden geliyor (geçmiş, bastırılmış olan) ve rüya \
sahibini nereye doğru çağırıyor (gelişim yönü).

Yorumu hipotez olarak sun, hüküm olarak değil. Rüyanın ne dediğini kesin bilen bir \
merci değilsin; okumanı ortaya koy ve doğrulamayı rüya sahibine bırak — bir yorum \
ancak onda bedensel bir tanıma uyandırdığında doğrulanmış sayılır. Bunu her cümleye \
"belki" ekleyerek değil, iddiayı açık uçlu kurarak yap.

Rahatsız edici materyali olduğu gibi tut. Özellikle q4'e gelen cevap utandırıcıysa \
ya da kişinin kendi imajıyla çelişiyorsa bu büyük olasılıkla gölge materyalidir. \
Yumuşatma, atlama, patolojikleştirme; nazik ama dürüst bir çerçevede tut ve \
bütünleştiğinde neye dönüşebileceğini göster.

Karşıt çiftleri çözme. Rüyada kaçan/kovalayan, üst/alt, koruyan/tehdit eden gibi bir \
gerilim varsa bir tarafı haklı çıkarıp diğerini kötüleme; gerilimi olduğu gibi bırak, \
buluşma yerini rüya sahibine bırak.

Sadece veride olanı yaz. Rüyada, çağrışımlarda ya da soru cevaplarında geçmeyen \
hiçbir sahne, nesne, kişi ya da duygu uydurma; akıcılık için detay ekleme. Emin \
olmadığın yerde "belki", "sanki" diyerek açık bırak. Bir detay yoruma direniyorsa \
"burası henüz açılmıyor" de ve açıkta bırak — kolayca anlamlandırdıklarını seçip \
gerisini görmezden gelirsen yorum eksik olur.

Jungiyen terimleri (gölge, persona, anima, animus, Self, kompleks, bireyleşme) \
yalnızca veride gerçek karşılığı varsa ve tek kelimeyle kullan. Tanımlama, ders \
anlatma; okuyucu deneyimin içindeyken kavramı fark etsin.

Amaç egoyu rahatlatmak değil, büyütücü bir öz bilgi sunmak. Pohpohlayıcı sonuca \
kaçma.

## Kapanış

Son paragrafta iki iş yap:

Birincisi, kurduğun hipotezi (rüyanın hangi tutuma, hangi yaraya ya da hangi gelişim \
yönüne dokunduğunu) açıkça adıyla an ve bir sonraki adımın ne olabileceğini SORU \
biçiminde açık bırak. Kesin hüküm verme. Bu paragraf sadece bu rüyaya uymalı — başka \
bir rüyaya olduğu gibi kopyalanabiliyorsa yanlış yazmışsındır. "Bireyleşme \
yolculuğuna hoş geldin" türü genel övgüler her rüyaya uyar, bu yüzden hiçbirine uymaz.

İkincisi, somut bir ritüel öner. Bedensel ya da fiziksel olsun, bu rüyadaki somut bir \
sembolü içersin ve bugün ya da bu hafta on dakikada yapılabilsin. Tek cümle yeter. \
"Üzerine düşün", "farkında ol", "kendine sor" zihinsel önerilerdir, ritüel sayılmaz — \
elle yapılan bir şey olsun (bir nesneyle küçük bir jest, bir cümleyi yazıp saklamak, \
sembolü hatırlatan küçük bir davranış).

## Çıktı biçimi

Akıcı düzyazı yaz: 4-6 paragraf, yaklaşık 450-700 kelime. Başlık, alt başlık, madde \
işareti, numaralı liste, kalın yazı kullanma.

Rüya sahibine doğrudan "sen" diye hitap et. Türkçe, sıcak ama analitik bir üslup.

İlk cümle doğrudan yorumun içinden başlasın. Rüyayı özetleyerek ya da "bu rüyanda şu \
semboller var" diyerek giriş yapma.

Yukarıdaki yöntemin adlarını (çekirdek, amplifikasyon, kompansasyon, \
selected_association, q1, q2, q3, q4 gibi alan ve aşama adlarını) metinde asla anma. \
Bunlar senin iç çalışma yöntemin; rüya sahibi yöntemi değil kendi rüyasını okuyacak.

Ton örneği. Böyle YAZMA: "Yılan, pek çok kültürde dönüşümün sembolüdür ve bu rüyada \
bilinçdışının habercisi olarak karşına çıkıyor."
Böyle YAZ: "Yılan sana yaklaşırken hissettiğin o donma anı, 'kimseye hayır \
diyemiyorum' dediğin yerle aynı yerden geliyor; ikisi de aynı kaçışın iki yüzü."

VERİ:
{payload_json}

Şimdi bu veriye dayanarak yorumu yaz.
"""


def extract_symbols(dream_text: str) -> list[dict]:
    client = _get_client()
    prompt = EXTRACT_PROMPT.replace("{dream_text}", dream_text)
    response = client.models.generate_content(
        model=_model_name(),
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
        model=_model_name(),
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
            # aracına değil, modelin ADIM 7'de kullandığı kendi eğitim
            # verisindeki bilgiye dayanıyor; hiçbir dış servise bağımlılık yok.
        ),
    )
    return _extract_text(response)
