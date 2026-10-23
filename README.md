# Naberlo — Stadium Studio

Türkçe arayüzlü, kalıcı projelerle çalışan stadyum prodüksiyon uygulaması. Kullanıcının **STADIUM PRODUCTION ENGINE MASTER v43** iş akışını kulüp araştırması, referans görselleri, mimari planlama, görsel üretimi ve video prompt paketlerine dönüştürür.

## Windows ve telefonda ücretsiz açma

Sunucu kiralaman gerekmez. Program Windows bilgisayarında çalışır; aynı Wi-Fi ağına bağlı telefonundan da açabilirsin.

1. Bilgisayara [Node.js 24 veya daha yeni LTS](https://nodejs.org/en/download) sürümünü bir kez kur.
2. [Programı ZIP olarak indir](https://github.com/srcnunsn-droid/naberlo/archive/refs/heads/feat/stadium-production-studio.zip). ZIP'e sağ tıklayıp **Tümünü ayıkla** de.
3. Çıkardığın klasörde **BASLAT.bat** dosyasına çift tıkla. İlk açılışta gereken paketler internetten indirilir; ardından tarayıcı açılır. Siyah pencereyi açık tut.
4. Pencerede yazan **Giris kodu** ile giriş yap. Bu kod her açılışta değişir; projelerin silinmez.
5. Telefonu bilgisayarla aynı Wi-Fi'ye bağla. Telefonun tarayıcısına penceredeki **TELEFONDAN AC** adresini yaz; aynı giriş kodunu kullan. Birden fazla adres varsa Wi-Fi bağlantına ait olanı dene.

Windows güvenlik duvarı ağ izni sorarsa **Özel ağlar** için izin ver. Ev Wi-Fi ağının Windows'ta özel ağ olarak ayarlı olması gerekir. Mobil veri veya misafir Wi-Fi'siyle bu yerel bağlantı çalışmayabilir. Bilgisayar kapanırsa veya uykuya geçerse telefon bağlantısı da kapanır. İnternet modeminde port açman gerekmez.

Programı açmak, katalog, proje, prompt ve yüklemeleri kullanmak için ödeme veya API anahtarı gerekmez. Otomatik AI görsel üretimi ayrı bir sağlayıcı hesabı ve ücretli API gerektirir; bunu bağlamak zorunda değilsin.

Projeler `.data` klasöründe tutulur. Güncellerken eski klasörü ve içindeki `.data` dosyalarını silme; yeni indirdiğin ayrı bir klasör eski projeleri otomatik taşımaz.

## Bilgisayarda başlatma

Node.js **24+** gerekir. SQLite Node içinde gelir; ayrı veritabanı servisi gerekmez.

```bash
npm ci
npm run dev
```

Geliştirme arayüzü 5173, API 3001 portunda dinler. Üretim derlemesini tek sunucuyla çalıştırmak için:

```bash
npm run build
npm start
```

Üretim sunucusu varsayılan olarak `127.0.0.1:3001` üzerinde hem arayüzü hem API'yi sunar. Testler:

```bash
npm test
npm run test:e2e
```

Tarayıcı testleri için Chromium gerekir. Varsayılan yol `/usr/bin/chromium`; başka yerdeyse `CHROMIUM_PATH` ayarla. E2E testleri **güncel `dist`** üzerinde çalışır; önce `npm run build` çalıştır. Test verileri `/tmp` içinde, asıl çalışma alanından ayrı tutulur.

## Neler çalışır?

- **Kulüp atlası:** 91 ülkeden 2.777 OpenFootball kaydı, Türkçe karakterlere toleranslı arama, ülke/bölge filtreleri, sayfalama, kaynak bağlantıları ve JSON ile içe aktarma. Ağ erişimi varsa Wikidata üzerinden canlı araştırma.
- **Mimari tasarım:** Her seride 10 tema × 10 aday = 100 plan. Her planda kütle, plan şekli, çatı, taşıyıcı, cephe, yükseklik, giriş ve en az üç malzeme görevi bulunur. Yeni seri önceki adayları silmez. Bir projede 1.000 seri sınırı bulunur; sonrasında yeni proje açılabilir. Plan çeşitliliği, render kalitesi veya dünya çapında benzersizlik garantisi değildir.
- **Sıralı görsel üretimi:** SITE → R0 → E0 → C1–C10 → D0 → NB0 → N0 ve sokak, tifo, oyuncu, drone, lazer, şehir, havai fişek, özel gösteri açılış/final çiftleri. On kolaj tek işlemle sırayla kuyruğa alınabilir. Her kolaj ayrı bir API isteğidir; kabul edilmiş kolajlar atlanır.
- **Görsel referansları:** PNG/JPEG/WebP yükleme, gerçek referans dosyalarıyla OpenAI Images düzenleme, üretim kuyruğu, hata/iptal durumu ve sürüm arşivi. Yüklemeler 15 MB / 50 megapiksel ile sınırlıdır, sunucuda PNG'ye dönüştürülür.
- **Doğruluk kilidi:** Resmi kaynak veya iki farklı kaynak alan adıyla kullanıcı doğrulaması; kaynak/tarih kaydı. Doğrulanmayan kimlik bilgileri render'a taşınmaz. Uygulama kaynak içeriklerini otomatik olarak teyit etmez. Katalogdaki eski sponsor adları güncel kabul edilmez.
- **Kalite kontrolü:** Her dosya önce `review` durumundadır. Altı maddenin insan tarafından kontrolü gerekir. Bir referans değişirse ona bağlı kabul edilmiş dosyalar geçersizleşir. On kolaj kabul edilmeden mimari seçimi açılmaz. Oyuncu için ayrıca açık seçim gerekir.
- **Kamera:** 10 kamera reçetesi. Dönüşüm ailesi Kamera A ile sabittir; diğer sahneler eşleşmiş kendi kameralarını kullanır. Sokak için geniş/tele tercih seçimi vardır. FPV reçetesi opsiyonel video yönlendirmesidir; desteklenmeyen model özelliği varmış gibi render edilmez.
- **Varyasyon motoru:** 16 söküm yöntemi × 8 ritim × 6 başlangıç yönü × 4 materyal tepkisi = **3.072**; 10 doğuş yöntemiyle aynı eksenler = **1.920**; 20 kutlama × 8 ritim × 5 kompozisyon × 4 yoğunluk = **3.200**. Toplam **8.192 farklı derlenmiş yönlendirme**. Bunlar 8.192 hazır video veya tamamen ayrı fiziksel mekanizma değildir. Özel kutlama seçimi SH0/SHF görsellerine ve VSHOW klibine uygulanır.
- **Video paketi:** Seedance/Higgsfield için İngilizce, 10 saniyelik zaman çizelgeli promptlar. `@image-1` / `@image-2` eşlemesi yalnızca gerçek kabul edilmiş dosyalar varsa yazılır. Eksik çiftler taslak olarak işaretlenir.
- **Dışa aktarma:** Proje JSON'u, kaynak master, İngilizce görsel/video promptları, gerçek görseller ve 1080×1920 çıktılarını içeren ZIP. 9:16 çıktılarda görüntü kesilmez; boş alan doldurulur. Veritabanı ve sağlayıcı anahtarları pakete girmez.

## Görsel servisini bağlama

`.env.example` dosyasını **mevcut `.env` dosyan yoksa** `.env` olarak kopyala. Anahtarı güvenli şekilde bu yerel dosyaya veya bulut ortamı ayarlarına ekle:

```dotenv
STADIUM_OPENAI_API_KEY=...
OPENAI_IMAGE_MODEL=gpt-image-1
```

`OPENAI_API_KEY` mevcutsa alternatif olarak kullanılır. Anahtar tarayıcıya gönderilmez. Ortam değişkenleri `.env` değerlerinden önceliklidir. Anahtar/model değiştiğinde sunucuyu yeniden başlat.

Bağlantı `/v1/images/edits` kullanır; prompt ve kabul edilmiş gerçek görsel dosyalarını multipart biçiminde yollar. Varsayılan boyut `1024x1536` ve `n=1`'dir. Değiştirdiğin modelin hesabında **çoklu görsel düzenleme**, bu boyut ve `b64_json` çıktısını desteklemesi gerekir. Bu uygulama erişilemeyen bir “GPT Image 2.5” modelinin var olduğunu varsaymaz.

Üretim düğmesi önce istek sayısını ve olası sağlayıcı ücretini gösterir. Anahtar tanımlı olması, ücretli bir çağrının başarıyla doğrulandığı anlamına gelmez. Ağ hatası, kota veya sunucu yeniden başlaması durumunda ücretli istek otomatik tekrarlanmaz. Sağlayıcıya ulaşmış bir isteği iptal etmek ücretin geri alınacağını garanti etmez.

Anahtar olmadan da katalog, mimari planlar, promptlar, yükleme, kalite kontrolü, proje kaydı ve ZIP dışa aktarma çalışır. Dışarıdaki bir görsel aracında promptu kullanıp sonucu ilgili aşamaya yükleyebilirsin.

## Önerilen kullanım

1. **Yeni proje** ile kulübü seç. Katalogdaki bilgiler kaynaklı başlangıç verileridir.
2. **Kimliği doğrula** ekranında güncel kulüp, stadyum, şehir, renk, simge ve coğrafyayı kontrol et. Gerçek arsa sınırını ve en az beş şehir sabitini kaydet.
3. Gerçek stadyum fotoğrafını **SITE**, resmi armayı **CREST** rolünde yükle ve kalite kontrolünü tamamla.
4. R0'ı üret/yükle ve kabul et; ardından R0'ı kaynak alan tek katmanlı E0'ı hazırla.
5. On tasarım kolajını üret/yükle. Her birinde 2 sütun × 5 satır ve 10 farklı yapı olduğunu kontrol et. **Plan sekmesindeki SVG'ler yalnızca temsili şemalardır**, gerçek stadyum veya üretilmiş mimari görsel değildir.
6. On kolaj kabul edilince gerçek kolajdaki hücreye karşılık gelen adayı seç. D0 → NB0 → N0 ve gereken yan sahneleri sırayla oluştur.
7. Oyuncu tifosu için doğrulanmış oyuncuyu açıkça seç ve PLAYER referansını ekle.
8. Video promptlarını ve ZIP paketini indir; videoları seçtiğin platformda render et. **Bu sürüm video render servisi içermez.**

Yeni stadyumlar, yaratıcı arsa değişiklikleri ve kutlamalar AI konseptleridir. Gerçek proje/onay veya gerçekleşmiş olay olarak sunulmaz. Görsel devamlılığın kusursuz olması garanti edilmez; kabul insan kontrolüne dayanır.

## Veri, kaynaklar ve yedekleme

- Asıl veritabanı: `.data/studio.sqlite` (WAL modu).
- Görseller: `.data/media/`.
- Alternatif kalıcı konum: `STADIUM_DATA_DIR`.
- Tam yedek için uygulamayı durdurup **tüm veri klasörünü** kopyala. Çalışırken yalnızca `.sqlite` dosyasını kopyalamak WAL değişikliklerini atlayabilir.
- ZIP paketleri projeye ait taşınabilir çıktı paketidir; bu sürüm ZIP'ten proje geri yükleme arayüzü içermez.
- Gerçek API anahtarları `.env` içinde kalır ve Git tarafından yok sayılır.

Kulüp verisi: [OpenFootball/clubs](https://github.com/openfootball/clubs), CC0. Kaynak commit ve her kaydın dosya bağlantısı saklanır. [Lisans](data/OPENFOOTBALL-LICENSE.md), [katalog meta verisi](data/catalog-meta.json). Katalog dünyanın bütün kulüplerinin güncel ve eksiksiz listesi değildir. Tüm ülkelerden yeni kulüp eklemeye açıktır.

Kataloğu yenilemek için kaynak depoyu ayrı bir geçici klasöre indir, sonra:

```bash
npm run catalog:import -- /path/to/openfootball-clubs
```

Bu komut `data/clubs.json` ve kaynak meta verisini yeniler. Sunucuyu yeniden başlat. Sonradan UI/API ile eklenmiş kayıtlar veritabanında korunur.

UI içe aktarmasının örnek biçimi:

```json
[
  {
    "id": "my-club",
    "name": "Kulüp adı",
    "country": "Turkey",
    "city": "Şehir",
    "stadium": "Stadyum adı",
    "source": "https://example.com/official-club"
  }
]
```

## Ağ ve erişim

Bağımlılıklar için `registry.npmjs.org`; katalog güncellemesi için `github.com` / `raw.githubusercontent.com`; canlı araştırma için `www.wikidata.org`; görsel servisi için `api.openai.com` gerekir. Yazı tipleri yerel paketlenir; Google Fonts bağlantısı gerekmez. Proxy değişkenleri varsa sunucu `undici` ile mevcut HTTP(S) proxy ayarlarını kullanır. TLS doğrulaması kapatılmaz.

Varsayılan yerel, tek çalışma alanıdır; çok kiracılı bir SaaS değildir. Dış erişim için HTTPS reverse proxy, `HOST=0.0.0.0` ve **STADIUM_ACCESS_TOKEN** tanımla. Dış host ile anahtarsız API başlatma reddedilir. Tarayıcı erişim anahtarını yalnızca oturum belleğinde (`sessionStorage`) tutar. Üretim API'si ve medya bu anahtarla korunur. Geliştirme sunucusunu açık internete yayımlama.

## Mimari

- `src/`: React + TypeScript, duyarlı Türkçe arayüz, yerel yazı tipleri.
- `shared/engine.ts`: mimari matrisi, bağımlılıklar, doğruluk kapıları, prompt derleyicisi.
- `shared/catalog.ts`: yöntemler, kameralar, tifo/kutlama eksenleri, kalite maddeleri.
- `server/`: Express API, Node SQLite, görsel yükleme/düzenleme, sıralı kuyruk, ZIP.
- `tests/`: motor, gerçek HTTP/veritabanı, sağlayıcı sözleşmesi (mock) ve Chromium uçtan uca testleri.
- `docs/STADIUM-MASTER-v43.txt`: kullanıcının sağladığı kaynak iş akışı.

Görsel servisinin gerçek ücretli çağrısı ve Wikidata erişimi, ilgili anahtar/ağ izni olmadan doğrulanamaz. Mock sağlayıcı testi gerçek bir render kanıtı değildir. Google Earth ekran görüntüleri ve resmi arma/oyuncu görselleri uygulamayla dağıtılmaz; kullanıcı referans olarak sağlar.
