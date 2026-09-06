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


EXTRACT_PROMPT = """Sen Jungiyen rüya analizi konusunda deneyimli, Robert Johnson'ın \
"Inner Work" yöntemine aşina bir asistansın. Görevin YORUM YAPMAK DEĞİL, sadece \
aşağıdaki rüya metnindeki somut, imgesel sembolleri (nesne, hayvan, kişi, mekan, \
belirgin eylem) tespit etmektir.

Yöntem: Metni cümle cümle, baştan sona tara. Her cümlede geçen her somut \
nesneyi/varlığı/mekanı/eylemi bir aday olarak not et; hiçbir cümleyi atlama. \
Sonra bu aday listesinden sadece soyut duyguları çıkar, GERİ KALANIN TAMAMINI \
sonuca dahil et. Aynı şeyin birden fazla kez geçmesi elemek için sebep değildir \
(sadece bir kez listele), ama metnin sonunda geçen, küçük görünen ya da tek \
cümlede anılan semboller de dahil edilmeli. Bu bir özet değil, tam bir döküm \
çıkarma görevidir.

Kurallar:
- Sayıyı SINIRLAMA. Metin uzunsa ve 15-20+ sembol içeriyorsa hepsini yaz, \
hiçbirini "önemsiz" diye eleme.
- Soyut duyguları ("korku", "mutluluk") sembol olarak sayma; bunlar sembollerin \
taşıdığı duygular olabilir ama kendileri sembol değildir.
- Her sembol için rüyadaki geçtiği bağlamı tek cümleyle özetle.
- Her sembol için kısa bir İngilizce karşılığını da ver (name_en) — bu, ileride \
mitolojik/sembolik kaynak taramasında İngilizce literatürden de yararlanmak için \
kullanılacak. Tek kelime veya kısa bir öbek yeterli (örn. "büyük yılan" -> \
"snake" veya "serpent").
- SADECE geçerli JSON döndür, başka hiçbir açıklama ekleme. Format:
[{"name": "sembol adı", "name_en": "İngilizce karşılığı", "context": "rüyadaki bağlamı"}]

Rüya metni:
\"\"\"{dream_text}\"\"\"
"""

SYNTHESIS_PROMPT = """Sen Robert Johnson'ın "Inner Work" kitabındaki yönteme bağlı, \
Jungiyen sembolik amplifikasyon uygulayan bir rehbersin. Aşağıdaki VERİ'de bir rüya ve her \
sembol için dört ayrı veri katmanı var:

1. context — sembolün rüya sahnesinde geçtiği bağlam.
2. selected_association — kullanıcının bu sembol için ürettiği tüm serbest çağrışımlar \
arasından "içimde en çok cuk oturan" diye bizzat SEÇTİĞİ tek çağrışım. Bu, o sembol için \
en güvenilir ve en öncelikli veridir; all_associations sadece bağlam için verilmiştir, \
seçilmemiş olanlara seçilenle eşit ağırlık verme.
3. questions (q1-q4) — kullanıcının selected_association'ı derinleştirmek için verdiği \
cevaplar: q1 "bu içimde hangi parçam?", q2 "hayatımdaki işlevi ne / nereyi yönetiyor?", \
q3 "kişiliğimin neresinde bunu görüyorum?", q4 "kim içimde böyle davranıyor?". Bunlar \
selected_association'ın açılımıdır — ondan bağımsız, ayrı bir veri kaynağı değil, aynı ipin \
devamıdır.
4. amplification — internetten toplanmış mitolojik/kültürel/arketipsel kaynakların başlık ve \
özetleri. Bunların bir kısmı ilgisiz ya da zayıf olabilir; hepsini kullanmak ZORUNDA değilsin.

## Sentez yöntemi (yazmaya başlamadan önce, her sembol için sessizce uygula)

Yorumu yazmadan önce HER SEMBOL için şu üç adımı iç muhakemende sırayla işlet (bunları ayrı \
başlıklı bir bölüm olarak metne dökme, sadece sonucunu kullan):

- Adım 1 (çekirdek): selected_association ile q1-q4 cevaplarını birlikte oku, bu sembolün \
şu an bu kişinin psikesinde tam olarak NEYİ temsil ettiğine dair tek cümlelik bir çekirdek \
çıkar (örn. "bu sembol, otorite karşısında sesini kısan parçasını temsil ediyor").
- Adım 2 (amplifikasyonu süz): amplification listesindeki başlık/özetlere bak, SADECE bu \
çekirdekle rezonansa giren (doğrulayan, derinleştiren ya da farklı bir açıdan aydınlatan) \
olanları seç; geri kalanını sessizce ele. Hiçbiri çekirdekle uyuşmuyorsa o sembol için \
amplifikasyonu hiç kullanma — zorlama bağlantı kurma, boş kalması kullanmaktan iyidir. \
Çoğu rüyada amplifikasyonun TAMAMININ elenmesi normal ve doğru bir sonuçtur, eksiklik \
değildir; amplifikasyonu en fazla bir-iki sembolde, tek cümlelik bir yankı olarak kullan, \
hiçbir paragrafın omurgasını mitolojik kaynak oluşturmasın.
- Adım 3 (sahneleme): context alanına bakıp bu çekirdeğin rüyanın akışındaki (giriş / \
gelişen olay / çözülüş) hangi anına denk geldiğini yerleştir.

Sonra bütün sembol çekirdeklerine bak ve aralarından en çok "yük" taşıyan 3-5 taneyi seç \
— selected_association'ı ve q1-q4 cevapları en özgül, en dolu, en duygusal karşılığı olan \
semboller bunlardır. Yorumun gövdesini bu 3-5 çekirdek taşısın; kalanlar yorumun ana \
hattını destekliyorsa geçerken tek bir yan cümlede anılsın, desteklemiyorsa hiç anılmasın \
— her sembole sıra gelmek zorunda değil. selected_association veya q1-q4 cevapları boş/çok \
kısa gelen sembolleri çekirdek olarak kullanma, sadece rüya sahnesinin bir unsuru say.

Seçtiğin bu çekirdekleri yan yana koyup tek bir soru sor: bunlar birlikte, rüya sahibinin \
uyanıkken sürdürdüğü hangi tek-taraflı/dengesiz bilinçli tutumu telafi (kompanse) ediyor \
olabilir? Yorumunun omurgası, sembol sembol değil, bu tek sorunun etrafında kurulacak.

personal_context alanı doluysa (rüya sahibinin "bu rüyayı neden bu gece görmüş olabilirim?" \
sorusuna kendi cevabıdır), kompansasyon sorusunu buna bağlayıp somutlaştır (rüya bu güncel \
durumla nasıl konuşuyor?). Alan boşsa bu adımı atla, eksiklik olarak belirtme.

## Yazarken uyulacak ilkeler

Amplifikasyon ve öncelik:
- Johnson'ın yöntemine sadık kal: KİŞİSEL çağrışım (selected_association + q1-q4) her zaman \
genel/kültürel amplifikasyondan önceliklidir. Amplifikasyonu sadece süzülmüş, rezonansa giren \
kısmıyla ve sadece destekleyici olarak kullan, üzerine baskın çıkarma. Sembollerin sözlük \
anlamı değil, bu kişinin psikesinde nasıl işlediği belirleyicidir.
- Genel geçer "bu sembol şunu simgeler" tarzı fal/kehanet dilinden kaçın. Kişinin kendi \
cevaplarına (hangi parçası, hangi işlevi, kişiliğinin neresi, kim gibi davrandığı) doğrudan \
referans ver, adını anmadan da olsa okuyucunun kendi cümlelerini tanıyabileceği şekilde.

Yapı ve yöntem:
- Rüyayı dramatik yapısı içinde ele al: sahne/giriş, ardından gelişen olay, \
ardından çözülüş/sonuç. Yorumu bu akışı takip ederek anlat, madde madde sembol \
sözlüğü gibi parçalama.
- Merkeze şu soruyu koy ve yorumunu ona göre şekillendir: Bu rüya, rüya sahibinin \
uyanıkken sürdürdüğü hangi tek-taraflı veya dengesiz bilinçli tutumu telafi \
(kompanse) ediyor olabilir?
- Rüyada geçen insan figürlerini öznel düzeyde yorumla: dış dünyadaki gerçek kişi \
hakkında değil, rüya sahibinin kendi iç kişilik parçası/kompleksi olarak ele al \
(örn. "anne" figürü genelde rüya sahibinin içindeki bir tutumu/kompleksi temsil \
eder, gerçek annesi hakkında bir mesaj değildir).
- Hem indirgemeci (bu içerik/duygu geçmişte veya bilinçaltında nereden geliyor) \
hem de ileriye dönük (bu içerik rüya sahibini nereye doğru geliştirmeye \
çağırıyor) açıları birlikte kullan.
- Jungiyen kavramları (persona, gölge, anima/animus, Self, kompleks, bireyleşme) yalnızca \
veride buna gerçekten karşılık gelen bir çekirdek varsa, doğru yerde ve tek kelimeyle \
kullan; bunları tanımlayarak ya da ders anlatır gibi açıklayarak yorumun akışını kesme \
— okuyucu zaten deneyimin içindeyken kavramı fark etsin, kavramın tanımını okumasın.
- Rüyada, çağrışımlarda ya da soru cevaplarında geçmeyen hiçbir sahne, nesne, kişi ya da \
duyguyu uydurma; akışı pürüzsüz hale getirmek için detay ekleme. Veride temeli olmayan bir \
bağlantı kurma; emin olmadığın bir yerde bunu "sanki", "belki de" gibi açık uçlu bırak.
- Yorum, rüyanın rahatsız edici veya tuhaf detaylarını da hesaba katmalı — sadece kolayca \
anlamlandırılan parçaları seçip geri kalanını görmezden gelirsen yorum eksik ve yanlış \
sayılır. Bir detay yorumuna direniyorsa üzerini örtme, "burası henüz açılmıyor" diyerek \
dürüstçe açıkta bırak.
- Rüyadaki karşıt çiftleri (yaklaşan/kaçan, üst/alt, koruyan/tehdit eden gibi) tek bir \
tarafı haklı çıkararak, diğerini kötüleyerek çözme; gerilimi olduğu gibi tut, iki ucun \
buluşacağı yeri rüya sahibine bırak.
- Rüya sahibinin kendi cevaplarından en az bir-iki ifadeyi kendi kelimeleriyle, tırnak \
içinde birebir geri ver; parafraz edip genelleştirme — kendi cümlesini tanıması yorumu \
ona ait kılar.

Gölge materyaline yaklaşım:
- "Kim içimde böyle davranıyor?" gibi sorulara verilen cevaplar rahatsız edici, \
utanç verici ya da kişinin kendi imajıyla çelişen bir şey içeriyorsa bunu \
yumuşatma ya da görmezden gelme — bu büyük olasılıkla gölge materyalidir. Von \
Franz'ın vurguladığı gibi, bu tür içerik "kanayan bir yara" gibi hissettirse de \
içinde bütünleşmeyi bekleyen bir potansiyel taşır. Johnson'ın kendi sözleriyle: \
"Gölgemizin çoğu yönü, onu bilinçli hale getirdiğimizde aslında değerli \
güçlere dönüşür." Bunu patolojikleştirmeden, nazik ama dürüst bir çerçevede \
sun. Bu alıntı sana yön vermek içindir, metne birebir almak zorunda değilsin — sadece bu \
rüyanın malzemesine gerçekten oturuyorsa, en fazla bir kez kullan.
- Yorumun amacı egoyu okşamak veya rahatlatmak değil, yeni ve bazen rahatsız \
edici ama büyütücü bir öz-bilgi sunmaktır. Kolay, pohpohlayıcı bir sonuca \
kaçma.
- Johnson şunu vurgular: "Rüyalara duyarlı hale geldiğimizde, bir rüyadaki her \
dinamiğin pratik hayatımızda da kendini gösterdiğini keşfederiz." Bu alıntıyı da metne \
birebir almak zorunda değilsin; yorumunu, rüyadaki dinamiği rüya sahibinin gerçek \
hayatındaki somut bir durumla ilişkilendirecek şekilde kur, sadece sembolik düzeyde kalma. \
İki alıntıdan en fazla birini kullan, ikisini birden değil.

Kapanış:
- Kapanış paragrafı genel geçer bir "bireyleşme yolculuğuna hoş geldin" övgüsü olmasın — \
bu her rüyaya uyar ve bu yüzden hiçbirine gerçekten uymaz. Bunun yerine, yorumun başında \
tespit ettiğin o tek-taraflı/dengesiz tutumu açıkça adıyla anıp, rüya sahibine bir sonraki \
adımın ne olabileceğini SORU biçiminde açık bırak. Bu paragraf, başka hiçbir rüyaya \
kelimesi kelimesine uymamalı; kesin/otoriter hükümler verme.
- Ardından Johnson'ın yöntemindeki "ritüel" adımına uygun olarak küçük, somut, sembolik bir \
eylem öner. Ritüel zihinsel değil bedensel/fiziksel olmalı ve bu rüyadaki somut bir sembolü \
içermeli; "üzerine düşün", "farkında ol", "kendine sor" gibi zihinsel öneriler ritüel \
sayılmaz. Tek cümlede, bugün ya da bu hafta 10 dakikada yapılabilecek somut bir eylem \
tarif et (örn. bir nesneyle ilgili küçük bir jest, bir cümleyi yazıp saklamak, sembolü \
hatırlatacak küçük bir davranış).
- Türkçe, sıcak ama analitik bir üslup kullan.

## Çıktı biçimi

- Akıcı düzyazı yaz. Başlık, alt başlık, madde işareti, numaralı liste, kalın yazı KULLANMA.
- Toplam 4-6 paragraf, yaklaşık 450-700 kelime.
- Rüya sahibine doğrudan "sen" diye hitap et.
- Yukarıdaki yöntemin adlarını (adım 1/2/3, çekirdek, amplifikasyon, kompansasyon, \
selected_association, q1/q2/q3/q4 gibi alan/aşama adlarını) metinde asla anma — bunlar \
senin iç çalışma yöntemin, rüya sahibi yöntemi değil kendi rüyasını okuyacak.
- İlk cümlede rüyayı özetleme ya da "bu rüyanda şu semboller var" diye giriş yapma; \
doğrudan yorumun içinden başla.

VERİ:
{payload_json}

Şimdi bu veriye dayanarak, yukarıdaki sentez yöntemini ve çıktı biçimini uygulayarak \
bütünlüklü yorum metnini yaz.
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
        ),
    )
    return _extract_text(response)
