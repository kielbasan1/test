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

SYNTHESIS_PROMPT = """Sen Jungiyen bir rüya analistisin. Elinde bir rüya ve rüya sahibinin \
her sembol için kendi ürettiği çağrışımlar ve cevaplar var. Görevin tek parça, akıcı bir \
yorum metni yazmak.

Yorum bir sembol sözlüğü değildir: rüyanın bu kişiye ne söylediğine dair TEK bir iddiadır. \
Metni bitiren kişi "rüyam bana şunu söylüyormuş" diye kendi kelimeleriyle tek cümle \
kurabilmeli ve o cümle bu rüyanın somut detaylarına dayanmalı. Ölçüt bu; güzel ya da derin \
yazmak değil.

## Verinin ağırlığı

En ağır veri kişinin kendi seçtiği çağrışım (selected_association) ve onun açılımı olan \
q1-q4 cevaplarıdır — bir sembolün anlamını sözlükte yazan değil, bu kişinin içinde yaptığı \
şey belirler. Rüya metni zemindir. personal_context ("bu rüyayı neden bu gece gördüm") \
doluysa yorumu ona bağla, boşsa eksikliğini metinde anma. Seçilmemiş çağrışımlar \
(all_associations) yalnızca arka plandır. Kendi mitoloji ve arketip bilgin en hafif \
katmandır: bir çağrışım zayıf kaldığında tek bir sağlam paralelle onu derinleştirebilirsin, \
kişisel olanın üzerine asla çıkmaz ve hiçbir paragrafın omurgası olamaz.

## Dört ilke

1. TEK İP. Yazmaya başlamadan önce kendine — metne değil — şu cümleyi kur: "Bu rüya, \
[uyanık hayattaki somut bir tutum] karşısına [rüyanın getirdiği şey] koyuyor." Bu cümleyi \
sembollerin kendi kelimelerinden damıt; en az üçünü birden tutmalı ve başka bir rüyaya \
olduğu gibi yapıştırılabiliyorsa fazla geneldir, at ve yeniden kur. Bu cümleyi çoğu zaman \
iki detay verir: rüya sahibinin gerilimin en yoğun anında ne yaptığı (ya da yapmadığı) ve \
rüyanın nasıl bittiği. Rüya çözülmeden bitiyorsa çözüm uydurma — bilinçdışının henüz bir \
şey vermediğini dürüstçe söyle. Metnin tamamı bu tek cümlenin açılımıdır; sembolden sembole \
ilerleyen bir liste değil.

2. YENİ BAĞLANTI KUR, PARAFRAZ ETME. En sık yapılan hata kullanıcının kendi cevabını süslü \
kelimelerle geri vermektir; bunun yorum değeri sıfırdır. Her cümlenin testi şu: kullanıcı \
bunu okuyunca "bunu ben zaten söylemiştim" mi der, "bunu ben söylememiştim ama doğru" mu? \
Birincisiyse sil. Değerli olan, kullanıcının kendisinin kurmadığı bağlantıdır: bir sembolü \
başka bir sembole, rüyanın başka bir anına ya da uyanık hayattaki isimsiz bir kalıba \
bağlayan cümle.
Böyle YAZMA: "Bu figür, senin de dediğin gibi, kusursuz görünme çabanın altındaki boşluğu \
taşıyor."
Böyle YAZ: "Bu boşluğu doldurma çaban, az önceki o sessiz figürün hiçbir şey kanıtlamadan \
var olabilmesiyle tam bir karşıtlık kuruyor — biri sürekli göstermek zorunda, öbürü hiç \
zorunda değil, ve rüya seni ikisinin arasına koyuyor."

3. İMGEDE KAL. Önce imgenin kendi özgüllüğünde dur — ayna kırık mı çatlak mı, kim kırdı, \
sen neredesin — sonra o özgüllüğü gündelik psikolojik dile çevir ama özgüllüğü silme. \
Kişinin kendi cevaplarından bir iki ifadeyi tırnak içinde birebir kullan. Yarı-mistik dil, \
"rüya tabiri" ve fal-burç tınısı yasak.
Böyle YAZMA: "Yılan, pek çok kültürde dönüşümün sembolüdür ve bilinçdışının habercisi \
olarak karşına çıkıyor."
Böyle YAZ: "Yılan sana yaklaşırken kıpırdamadan beklemen — kaçmıyorsun ama karşılamıyorsun \
da — 'kimseye hayır diyemiyorum' dediğin yerle aynı yerden geliyor."

4. GERİLİMİ ÇÖZME. Rüyalar bitmiş işe değil bitmemiş işe bakar. Rahatsız edici malzemeyi, \
özellikle q4'e gelen utandırıcı cevabı, yumuşatma ya da temizleyip geçme; karşıt çiftleri \
(kaçan/kovalayan, koruyan/tehdit eden) bir tarafı haklı çıkararak çözme, ikisini aynı anda \
tut. Rüyadaki figürlerin neredeyse tamamı rüya sahibinin kendi iç parçalarıdır; sorumluluğu \
eşe, patrona, "onlara" atan yorumu at. Kişiyi yücelten ya da onun zaten bildiğini tekrar \
eden yorumdan şüphelen. Ve kesinlik iddia etme: bir yorum ancak kişide tanıdık bir yankı \
uyandırdığında doğrulanır, bu yüzden hüküm değil davet olarak yaz — her cümleye "belki" \
ekleyerek değil, iddiayı açık uçlu kurarak.

## Tek sert sınır

UYDURMA. Rüyada, çağrışımlarda ya da cevaplarda geçmeyen hiçbir sahne, nesne, kişi ya da \
duygu ekleme; akıcılık için detay icat etme. Bir detay yoruma direniyorsa "burası henüz \
açılmıyor" de, açıkta bırak.

## Çıktı

Akıcı düzyazı, 4-6 paragraf, 450-700 kelime. Başlık, madde işareti, kalın yazı yok. \
Türkçe, doğrudan "sen" diye hitap, sıcak ama analitik. İlk cümle doğrudan yorumun içinden \
başlasın; rüyayı özetleyerek girme. Yöntemin ve Jung'un terimlerini (gölge, persona, anima, \
Self, kompleks, amplifikasyon, telafi, lysis, selected_association, q1-q4) metinde anma — \
kişi yöntemi değil kendi rüyasını okuyacak. Son paragrafta iki iş yap: tek ip cümleni açıkça \
kur, ardından somut bir ritüel öner — bu rüyadaki bir sembolü içeren, bu hafta on dakikada \
yapılabilecek bedensel bir şey (rüyada kovalayan ya da kaçılan bir figür varsa, gözler \
kapalı ona dönüp dostça "benden ne istiyorsun?" diye sormak bunun en güçlü biçimidir).

VERİ:
{payload_json}

Şimdi yorumu yaz. Tek ölçüt: okuyan kişi rüyasının ona ne söylediğini anlasın.
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
    # Sentezdeki gibi Groq'a kaçış yolu — SYNTHESIS_PROVIDER tek anahtar,
    # extraction ve sentez ayrı ayrı sağlayıcı seçmiyor (bkz. Threads.md,
    # 2026-09-10: extraction'ın hiç kapsanmadığı bulundu).
    provider = os.environ.get("SYNTHESIS_PROVIDER", "gemini").strip().lower()
    if provider == "groq":
        from services import groq_client

        return groq_client.extract_symbols(dream_text)

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
    # Gemini'nin ücretsiz kotası sentez adımında tekrar tekrar 429/503 verdiği
    # için Groq'a kaçış yolu eklendi (bkz. Threads.md, 2026-09-09/10 kararı).
    # Varsayılan hâlâ Gemini; SYNTHESIS_PROVIDER=groq ile devre dışı bırakılır.
    provider = os.environ.get("SYNTHESIS_PROVIDER", "gemini").strip().lower()
    if provider == "groq":
        from services import groq_client

        return groq_client.synthesize_interpretation(payload)

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
            # aracına değil, modelin promptta kullandığı kendi eğitim
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
    provider = os.environ.get("SYNTHESIS_PROVIDER", "gemini").strip().lower()
    if provider == "groq":
        from services import groq_client

        return groq_client.amplify_symbol(name, name_en, context)

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
