# Sembol Çarkı — Jungiyen Rüya Analizi

Robert Johnson'ın *Inner Work* yöntemine dayanan, rüya sembollerini kişisel
çağrışım "çarkına" çeviren ve ardından mitolojik amplifikasyon verisiyle
harmanlanmış bir yorum üreten lokal web uygulaması.

## Kurulum

1. Python paketlerini kur:

   ```
   pip install -r requirements.txt
   ```

2. API anahtarlarını `.env` dosyasına ekle:

   - **Gemini (ücretsiz)**: https://ai.google.dev → "Get API key" → `.env` içindeki
     `GEMINI_API_KEY` alanına yapıştır.
   - **Tavily (ücretsiz, 1000 sorgu/ay)**: https://tavily.com → hesap aç → API
     key'i `.env` içindeki `TAVILY_API_KEY` alanına yapıştır.

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
4. **Amplifikasyon & yorum** → her sembol için Tavily'den mitoloji/arketip
   odaklı kaynaklar taranır (sığ "rüya tabiri" siteleri hariç tutulur), sonra
   tüm veri (rüya + kişisel çağrışımlar + 4 soru cevapları + kültürel
   amplifikasyon) Gemini'ye verilip tek bir bütünlüklü yorum üretilir.
5. Sonuç ve kaynaklar `ruyalar/` klasörüne JSON olarak otomatik kaydedilir.

## Notlar

- `ruyalar/` klasöründeki kayıtlar rüya geçmişini oluşturur; `GET /api/dreams`
  ile listelenebilir, `GET /api/dreams/<dosya>` ile tek kayıt okunabilir.
- Kişisel çağrışım her zaman kültürel/mitolojik veriden önceliklidir — sentez
  prompt'u bu ilkeye göre yazılmıştır.
