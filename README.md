# Sembol Çarkı — Jungiyen Rüya Analizi

Robert Johnson'ın *Inner Work* yöntemine dayanan, rüya sembollerini kişisel
çağrışım "çarkına" çeviren ve ardından mitolojik amplifikasyon verisiyle
harmanlanmış bir yorum üreten web uygulaması.

## Kurulum

1. Python paketlerini kur:

   ```
   pip install -r requirements.txt
   ```

2. `.env` dosyasına Gemini API anahtarını ekle:

   - **Gemini (ücretsiz)**: https://ai.google.dev → "Get API key" → `.env` içindeki
     `GEMINI_API_KEY` alanına yapıştır.

   Sembol amplifikasyonu ayrı bir arama servisi ya da API anahtarı
   gerektirmiyor — model gerektiğinde kendi eğitim verisindeki mitoloji/
   arketip bilgisine başvuruyor. (Not: Gemini'nin Google Arama grounding
   aracı denendi ama billing'siz API key'lerde grounding kotası sıfır
   çıktı — ilk istekte 429 verdi; o yüzden ayrı bir arama katmanına hiç
   girişilmedi.)

3. Uygulamayı çalıştır:

   ```
   python app.py
   ```

4. Tarayıcıda `http://localhost:5000` adresini aç.

## Akış

1. **Rüyanı yaz** → Gemini rüyadaki somut sembolleri çıkarır (yorum yapmaz,
   sadece tespit eder).
2. **Her sembol için çark** → kendi serbest çağrışımlarını ok olarak eklersin;
   "cuk oturan" çağrışımı tıklayınca altın renge döner.
3. **4 soru** → seçtiğin çağrışım için Johnson'ın derinleştirme sorularını
   yanıtlarsın.
4. **Yorum** → tüm veri (rüya + kişisel çağrışımlar + 4 soru cevapları) tek
   bir Gemini çağrısına gider; model, sadece gerçekten emin olduğu ve iyi
   bilinen bir mitolojik/kültürel paralel varsa (en yüklü 3-5 sembolde) onu
   kendi bilgisinden ekler, emin değilse hiç kullanmaz.
5. **Sembol Haritası** → sonuç ekranında, yorumdan önce: rüya merkezde,
   semboller ilk halka, seçtiğin çağrışımlar ikinci halka. Yorumu okumadan
   önce kendi bağlantını kurmak istersen buradan başlayabilirsin.
6. Sonuç `ruyalar/` klasörüne JSON olarak kaydedilir, ayrıca sonuç ekranından
   `.txt` olarak indirilebilir/kopyalanabilir.

## Notlar

- `ruyalar/` klasöründeki kayıtlar rüya geçmişini oluşturur; `GET /api/dreams`
  ile listelenebilir, `GET /api/dreams/<dosya>` ile tek kayıt okunabilir.
- **Ücretsiz hosting'te deploy edeceksen:** çoğu ücretsiz platformun (Render,
  Railway free tier vb.) diski kalıcı değildir — sunucu yeniden başladığında
  `ruyalar/` klasörü silinir. Bu yüzden sonuç ekranındaki "İndir (.txt)"
  butonu var; kalıcı kopya istiyorsan onu kullan, sunucudaki kayda güvenme.
- Kişisel çağrışım her zaman kültürel/mitolojik veriden önceliklidir — sentez
  prompt'u bu ilkeye göre yazılmıştır.
