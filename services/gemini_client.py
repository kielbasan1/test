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


def _expand_model_name() -> str:
    # Kör nokta bulmak gerçek bağ kurma ve hipotez üretme gerektiriyor. Prompt
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

EXPAND_PROMPT = """Sen Jungiyen bir analistsin. Rüya sahibi bu rüyayla kendi başına \
çalıştı: sembollerini çıkardı, her biri için kendi çağrışımını seçti, dört soruyu \
cevapladı ve sonunda kendi yorumunu yazdı (my_interpretation). Şimdi sana o yorumu \
getiriyor.

Görevin yeni bir yorum yazmak DEĞİL. Onun yorumu yerinde kalır. Senin işin, verinin \
içinde açıkça durup onun yorumuna hiç girmemiş olanı göstermek — kişi kendi kör \
noktasına tanım gereği bakamaz, deneyimli bir analistin oradaki değeri de budur.

## Kör nokta nerede olur

Şu beş yere bak, hepsini birden zorlama — gerçekten orada olan iki üç tanesini al:
1. ATLANAN SEMBOL. Kişi bir sembole çağrışım ve cevap yazmış ama yorumunda o sembol \
hiç geçmiyor. Neyin dışarıda bırakıldığı çoğu zaman en anlamlı yerdir.
2. KENDİ CÜMLESİNİN AĞIRLIĞI. Cevaplarında sert, çıplak bir şey söyleyip yorumunda \
onu yumuşatmış olabilir — özellikle "kim içimde böyle davranıyor" sorusuna gelen cevap.
3. GÖRÜLMEYEN KARŞITLIK. İki sembol ya da iki cevap birbiriyle çelişiyor ve kişi \
çelişkiyi fark etmeden, çözülmüş gibi geçmiş.
4. RÜYA-EGO'NUN TUTUMU. Rüyada kişinin kendisinin ne yaptığı — kaçtı mı, izledi mi, \
sustu mu, geç mi kaldı — yorumda çoğu zaman kaybolur, oysa rüyanın asıl sorusu orada durur.
5. RÜYANIN BİTİŞİ. Rüya çözülmeden bitiyor ama yorum bir çözüme varıyorsa, o çözüm \
rüyadan değil kişinin kendisinden geliyordur.

## Kurallar

PARAFRAZ ETME. Onun yorumundaki bir cümleyi başka kelimelerle geri vermenin değeri \
sıfırdır. Her cümlenin testi: okuyan "bunu ben zaten yazmıştım" mı der, "buraya \
bakmamıştım" mı?
NOT VERME. "Güzel yakalamışsın", "doğru yoldasın" gibi değerlendirme cümlesi kurma; \
övgü de bir kör noktadır. Yorumunu düzeltmeye, yanlışlamaya da çalışma — yanına başka \
bir şey koy.
İMGEDE KAL. Kendi cevaplarından bir iki ifadeyi tırnak içinde birebir kullan, imgenin \
özgüllüğünü koru (ayna kırık mı çatlak mı, kim kırdı, sen neredesin). Yarı-mistik dil, \
"rüya tabiri" ve fal-burç tınısı yasak.
GERİLİMİ ÇÖZME. Karşıt çiftlerin bir tarafını haklı çıkarma, ikisini aynı anda tut; \
rahatsız edici malzemeyi temizleyip geçme. Rüyadaki figürlerin neredeyse tamamı kişinin \
kendi iç parçalarıdır, sorumluluğu eşe patrona "onlara" atma. Hüküm değil davet olarak \
yaz — her cümleye "belki" ekleyerek değil, iddiayı açık uçlu kurarak.
UYDURMA. Rüyada, çağrışımlarda, cevaplarda ya da onun yorumunda geçmeyen hiçbir sahne, \
nesne, kişi ya da duygu ekleme. Kör nokta bulamıyorsan sayı doldurmak için icat etme, \
azıyla yetin.

Böyle YAZMA: "Senin de dediğin gibi, kuyu figürü derinlere inme ihtiyacını temsil ediyor."
Böyle YAZ: "Kuyuya inmekten söz ediyorsun ama rüyada kuyunun başında duruyorsun, inen \
sen değilsin — ve 'hep başkası girer, ben beklerim' dediğin yer tam da burası."

## Çıktı

İki ilâ dört kısa paragraf, 200-350 kelime. Her paragraf tek bir kör noktayı açar ve \
onu veriden gösterir. Başlık, madde işareti, kalın yazı yok. Türkçe, doğrudan "sen" \
diye hitap, sıcak ama analitik. İlk cümle doğrudan kör noktanın içinden başlasın; ne \
yapacağını anlatarak girme. Jung'un ve yöntemin terimlerini (gölge, persona, anima, \
Self, kompleks, telafi, amplifikasyon, selected_association, q1-q4) metinde anma. Son \
cümle bir soru olsun — cevabını senin değil onun vereceği, rüyanın kendisinden çıkan \
bir soru.

VERİ:
{payload_json}

Şimdi yaz. Tek ölçüt: okuyan kişi kendi yorumuna dönüp "buraya bakmamıştım" desin.
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
    # Groq'a yönlendirilmiyor (SYNTHESIS_PROVIDER burada okunmuyor) — bilerek:
    # 2026-09-10'da gerçek test (scripts/test_gemini_quota.py, 25 art arda
    # istek) flash-lite'ın kotasının artık sağlıklı olduğunu (~500/gün, eski
    # "20/gün paylaşımlı" bulgusu bu modelde geçersiz hale gelmiş) doğruladı.
    # Yan fayda: Groq'un dar dakikalık çıktı-token sınırı artık sadece
    # sentezle paylaşılıyor, zengin rüyalarda extraction'ın onu tüketip
    # JSON'u yarıda kesmesi riski azalıyor. expand_interpretation hâlâ
    # Groq'ta kalıyor — Gemini flash aynı testte 503+429 ile başarısız oldu.
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


def expand_interpretation(payload: dict) -> str:
    """Kullanıcının KENDİ yorumunu (payload["my_interpretation"]) alıp onun
    göremediği kör noktalara işaret eder. Sıfırdan yorum üretmez — bu, eski
    "her zaman çalışan sentez" adımının yerini alan, istek üzerine çağrılan
    adımdır (bkz. PRODUCT.md: AI birincil değil, yorumu genişleten yardımcı).

    Gemini'nin ücretsiz kotası bu adımda tekrar tekrar 429/503 verdiği için
    Groq'a kaçış yolu var (bkz. Threads.md, 2026-09-09/10 kararı). Varsayılan
    hâlâ Gemini; SYNTHESIS_PROVIDER=groq ile devre dışı bırakılır.
    """
    provider = os.environ.get("SYNTHESIS_PROVIDER", "gemini").strip().lower()
    if provider == "groq":
        from services import groq_client

        return groq_client.expand_interpretation(payload)

    client = _get_client()
    prompt = EXPAND_PROMPT.replace(
        "{payload_json}", json.dumps(payload, ensure_ascii=False, indent=2)
    )
    response = client.models.generate_content(
        model=_expand_model_name(),
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=8192,
            # Kişinin kendi yorumunu, çağrışımlarını ve 4 soru cevaplarını
            # karşılaştırıp NEYİN EKSİK olduğunu bulmak dikkatli akıl yürütme
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
    ekranında kullanılır. expand_interpretation'dan farkı: burada kişisel
    çağrışım YOK, amplifikasyon tek girdi, o yüzden ayrı ve daha hafif bir
    istek. Extraction modelini kullanıyor — basit bir bilgi hatırlama
    görevi, genişletmedeki gibi çok adımlı muhakeme gerekmiyor; ayrı tutulmasının
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
