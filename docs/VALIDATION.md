# Doğrulama kapsamı

Uygulamanın doğrulaması üç düzeyde yapılır:

1. **Motor + gerçek HTTP + sağlayıcı sözleşmesi:** `npm test`. Mimari matrisin 100 kayıt / 10 kolaj olması, 8.192 farklı derlenmiş varyasyon, kritik kimlik kapıları, oyuncu izni, gerçek referans eşlemesi, kalıcı SQLite kayıtları, dosya yükleme/kabul, eski referansların geçersizleştirilmesi, ZIP, geçersiz girişler ve değişiklik çakışmaları.
2. **Gerçek Chromium:** `npm run build && npm run test:e2e`. Proje oluşturma, Türkçe arama, yeni seri, doğrulama formu, görsel yükleme ve kontrol, sayfa yenilemesinden sonra kalıcılık, ZIP indirme, varyasyon seçimi ve 390 px mobil taşma kontrolü.
3. **Dış servisler:** Wikidata canlı arama ve kulüp ayrıntısı ağ üzerinden ayrı kontrol edilir. OpenAI Images için gerçek ücretli render, kullanıcı anahtarı olmadan çalıştırılmaz. Test sağlayıcısı, gerçek PNG referanslarını multipart istekte alır ve kontrollü PNG yanıtı verir; bu bir model kalitesi testi değildir.

Testler asıl `.data` çalışma alanından ayrı geçici dizinlerde çalışır. Test görselleri renk bloklarıdır, gerçek stadyum üretimi değildir. Gerçek üretim çıktıları kullanıcı tarafından görsel kalite kontrolüne alınmalıdır.
