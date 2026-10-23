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

## Güncel bilgi ve SITE araştırması

`tests/project-research.test.ts` canlı arama araç sözleşmesini taklit ederek kaynaklı bilgilerin ve gerçek PNG referansının proje ön koşullarını açmasını doğrular. Hayali kaynak URL'leri, aynı kaynak ailesi, çelişki ve arama yapılmadan dönen model cevabı doğrulama sağlamaz. Görsel baytları model kontrolüne gönderilir; otomatik inceleme insan kontrolü olarak kaydedilmez. Eski çekim tarihinin korunduğu ve kesilen araştırmanın otomatik tekrar edilmediği test edilir. Bunlar kontrollü sağlayıcı testleridir; bu ortamda kullanıcı anahtarı olmadığı için gerçek ücretli 2026 araştırması veya fotoğraf kimlik/kalite doğruluğu test edilmiş değildir.

## Referanstan final filme

- `tests/story.test.ts`: altı tarifin bağımlılık grafiği, gerçek 4/8/12 saniye bütçesi, cadde ailesinin doğru geometri yönlendirmesi ve oyuncu/arma kapıları. Eski VSHOW ile yeni VS1–VS5 aileleri birbirine karışmaz.
- `tests/movie.test.ts`: gerçek FFmpeg ile sesli kırmızı ve sessiz mavi klipleri sırayla birleştirir. Piksel örnekleriyle sıra, 1080×1920 boyut, süre, ses kanalı, Türkçe/% metin işleme, 12 referans karesi ve geçersiz kesme aralığı denetlenir.
- `tests/film-automation.test.ts`: kontrollü OpenAI yanıtları ve gerçekten oynatılabilir sentetik MP4'lerle 4+8+4+4 saniyelik üretim zinciri çalışır, ardından gerçek 20 saniyelik final MP4 otomatik oluşturulur. İnsan kontrolü işareti uydurulmadığı doğrulanır. Model çağrıları taklittir; FFmpeg montajı gerçektir.
- `tests/reference-analysis.test.ts`: gerçek JPEG baytlarının 12 zaman etiketiyle gönderilmesi, sesin analiz edilmediğinin talimatta belirtilmesi, video dışına taşan olay zamanlarının reddi, API hatası/yeniden başlatmada ücretli tekrar yapılmaması.
- `tests/e2e/story.spec.ts`: Chromium'da film seçimi, Türkçe ayar kaydı, gerçek video yükleme ve 12 kare gösterimi; anahtarsız AI analizinin engellenmesi ve 390 px mobil ekran.

Referans incelemesi kullanıcının yüklediği 10 kopyanın metadata ve 192 örnek karesine dayanır; kesintisiz izleme veya ses analizi değildir. Raporun olay aralıkları yaklaşık değerlerdir. Gerçek ücretli OpenAI video/kare analizi bu ortamda çalıştırılmadı. Sora'ya kaynak hareket videosu veya ayrı final kare gönderilemez; çıktı kalitesi ve sahne eşleşmesi kullanıcı incelemesi gerektirir.

23 Ekim 2026 kontrol sonucu: 27 Node testi, 4 Chromium uygulama testi ve 1 çevrimdışı HTML testi geçti. Son önizleme uyumluluğu değişikliğinden sonra ilgili 7 Node testi ile Chromium önizleme testi ayrıca geçti. Normal/tek HTML derlemeleri, değişen dosyaların Prettier kontrolü ve kabuk sözdizimi kontrolü geçti. Depo genelindeki `format:check`, bu değişiklikten önce de biçim uyuşmazlığı bulunan `data/catalog-meta.json` ve `data/OPENFOOTBALL-LICENSE.md` dosyalarında uyarı verir; bu dosyalar değiştirilmedi.
