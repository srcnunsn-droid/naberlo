# Doğrulama kapsamı

Uygulamanın doğrulaması üç düzeyde yapılır:

1. **Motor + gerçek HTTP + sağlayıcı sözleşmesi:** `npm test`. Mimari matrisin 100 kayıt / 10 kolaj olması, 8.192 farklı derlenmiş varyasyon, kritik kimlik kapıları, oyuncu izni, gerçek referans eşlemesi, kalıcı SQLite kayıtları, dosya yükleme/kabul, eski referansların geçersizleştirilmesi, ZIP, geçersiz girişler ve değişiklik çakışmaları.
2. **Gerçek Chromium:** `npm run build && npm run test:e2e`. Proje oluşturma, Türkçe arama, yeni seri, doğrulama formu, görsel yükleme ve kontrol, sayfa yenilemesinden sonra kalıcılık, ZIP indirme, varyasyon seçimi ve 390 px mobil taşma kontrolü.
3. **Dış servisler:** Wikidata canlı arama ve kulüp ayrıntısı ağ üzerinden ayrı kontrol edilir. OpenAI Images ve Video için gerçek ücretli render, kullanıcı anahtarı olmadan çalıştırılmaz. Test sağlayıcısı, gerçek PNG referanslarını multipart istekte alır ve kontrollü PNG yanıtı verir; bu bir model kalitesi testi değildir.

Testler asıl `.data` çalışma alanından ayrı geçici dizinlerde çalışır. Test görselleri renk bloklarıdır, gerçek stadyum üretimi değildir. Gerçek üretim çıktıları kullanıcı tarafından görsel kalite kontrolüne alınmalıdır.

## Tek HTML sürümü

`npm run build:html && npm run test:html` ile derlenmiş tek dosyanın baytları Chromium'a verilir. Cloud Chromium yönetim politikası `file://` gezinmesini engellediği için test, HTML'yi yalnızca test yönlendirmesi üzerinden sunar; bir uygulama sunucusu çalıştırmaz. Tarayıcı çevrimdışıdır, ek HTTP/API/JS/CSS/yazı tipi isteği sayısının sıfır olduğu doğrulanır. Gerçek Windows çift tıklaması bu Linux ortamında test edilmemiştir.

Test yerel katalog aramasını, proje ve yeni seri oluşturmayı, gerçek PNG yükleme/kabulünü, yenileme sonrası kayıtları, ZIP indirmeyi, JSON yedeğini ayrı bir tarayıcı oturumuna geri yüklemeyi ve mobil ekran taşmasını kontrol eder. Tarayıcı kayıtları IndexedDB kullanır; otomatik AI üretimi ve canlı araştırma tek HTML sürümünde sunulmaz.

## OpenAI otomasyonu

- `tests/automation.test.ts`: gerçek SQLite/dosya deposuyla iki aşamalı akış; test sağlayıcısından 12 önizleme + 18 devam görseli + 11 video. Gerçek PNG referans baytları, video başlangıç karesinin 720×1280 boyutu, 12 saniye/model parametreleri ve indirilen dosyanın kaydı denetlenir. Test MP4'ü yalnızca kapsayıcı imzası içeren bir sözleşme fixture'ıdır; oynatılabilir gerçek üretim videosu değildir.
- Üretilen görsellerin `review` durumunda kaldığı, insan kalite onayının uydurulmadığı, geçerli çıktılarla yeni ücretli istek yapılmadığı, değişen referans/ayarların eski akışı durdurduğu doğrulanır.
- Video sorgulama hatasından sonra devam yalnızca GET yapar. Oluşturma isteğinin belirsiz sonucunda otomatik POST tekrarı yapılmaz.
- HTTP dağıtım testi anahtarsız erişimi, yabancı origin reddini, anahtar bağlantısını ve API yanıtlarında anahtarın dönmediğini kontrol eder. Anahtarlar test yer tutucularıdır.
- `tests/e2e/automation.spec.ts`: kontrollü API yanıtlarıyla gerçek kolaj görselinin kartlarda gösterilmesi, hücre seçimi, kalite durumunun korunması, 18/11 istek planı, mobil taşma ve parola alanı doğrulanır. Anahtarın tarayıcı depolamasına yazılmadığı kontrol edilir. Bu UI testi dış servis bağlantı testi değildir.

API sözleşmesi OpenAI'nin resmi Python SDK kaynaklarındaki [videos.py](https://github.com/openai/openai-python/blob/main/src/openai/resources/videos.py), [video_create_params.py](https://github.com/openai/openai-python/blob/main/src/openai/types/video_create_params.py) ve [video.py](https://github.com/openai/openai-python/blob/main/src/openai/types/video.py) ile karşılaştırıldı. Hesaba özel model erişimi, gerçek render kalitesi ve ücretli üretim henüz doğrulanmadı; bu ortamda kullanıcı API anahtarı bulunmuyor. Sora bağlantısı yalnızca bir başlangıç görseli destekliyor; ayrı final görseli denetimi sunulmuyor.
