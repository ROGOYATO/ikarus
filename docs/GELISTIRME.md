# Geliştirme notları

Sitenin yapısı, dosyaları ve yayınlama süreci. Takımın tanıtımı için kök dizindeki README'ye bakın.

Site: https://rogoyato.github.io/ikarus/

Üst çubuktaki **Uçaklarımız** menüsü iki sayfa arasında geçiş yapar:

- **Yeni uçağımız** (`index.html`): SUAS 2027 için geliştirilen uçak. Görev, temel rakamlar, teknik özet, ilerleme durumu, ekip, takım hikâyesi, ilk uçağa kısa bir değinme ve destek notu. Ayrı bir iletişim bölümü yok; takım e-postası destek bölümünde ve alt bilgide. İçerik ve görsel dil `docs/` altındaki tanıtım dokümanını izler.
- **İlk uçağımız** (`ilk-ucak.html`): TEKNOFEST 2026 Savaşan İHA Yarışması Kritik Tasarım Raporu'nun etkileşimli sürümü. Ana sayfaya gelen eski `#s…` / `#ref…` bağlantıları buraya yönlendirilir.

İlk uçağın sayfası rapor metnini, tablolarını, formüllerini ve şekillerini toplar. Ek olarak:

- Uçuş süresi hesaplayıcı (3.2.1), bütçe karşılaştırması (2.2)
- Alt sistem ağırlık merkezi grafiği ve sıralanabilir tablo (3.4)
- Kilitlenme zinciri, APF grid + A* rota simülasyonu, IBVS / kilitlenme dörtgeni demosu (4.1)
- Kamikaze dalış profili, G yükü ve QR piksel yoğunluğu hesapları (4.2)
- Haberleşme bağlantı haritası ve YKİ sekmeleri (6)
- Jetson çıkarım karşılaştırma grafiği ve işaretlenebilir uçuş kontrol listesi (8)

## Dosyalar

| Yol | İçerik |
| --- | --- |
| `index.html`, `src/home.js`, `src/home.css` | Yeni uçak sayfası |
| `ilk-ucak.html`, `src/main.js`, `src/styles.css`, `src/widgets/` | İlk uçak sayfası ve etkileşimli araçları |
| `src/planes.js`, `src/planes.css` | İki sayfada ortak "Uçaklarımız" menüsü |
| `src/shell.js`, `src/util.js` | Tema düğmesi, içindekiler, görsel büyütme |
| `public/img/` | İlk uçak sayfasının görselleri (WebP) |
| `docs/` | Tanıtım dokümanı (PDF); siteye dahil edilmez |

## Yeni uçak sayfası

- Metinler doğrudan `index.html` içindedir.
- Logo ve uçak çizimi, tanıtım PDF'inden (logo 1. sayfa, çizim 9. sayfa) çıkarılmış satır içi SVG'lerdir; renkleri temaya göre değişir. Tasarım değişirse PDF'ten yeniden çıkarılmalıdır (`pdftocairo -svg`).
- Renkler dokümandaki krem, lacivert ve turuncudur. Dokümanın yazı tipleri (Agency FB, Century Gothic) ücretli olduğundan yerine Google Fonts'tan Saira Extra Condensed ve Jost kullanılır.
- Açık/koyu tema seçimi tarayıcıda `ikarus-theme` anahtarıyla saklanır ve iki sayfada ortaktır.
- Giriş çizimindeki sol kanatçık PDF'te yoktu; sağdakinin simetriği olarak eklendi. Pervaneler (`.rotor` grupları) normalde yavaş (3 sn'de bir tur) döner, fare bir pervanenin göbeğine yaklaştıkça o pervane hızlanır (en çok saniyede 1,5 tur); her biri dört motor göbeğinin konumundan hesaplanan yatay düzlemde (itici pervane dikey düzlemde) döndürülür, bkz. `initRotors` (`src/home.js`). Her pervane, motoruyla birlikte bir `.rotor-set` grubundadır; izleyiciye bakan kanat her karede grubun sonuna (motorun önüne), uzaktaki kanat başına (arkasına) taşınır. İtici pervanenin kanatları gövdenin arkasında kaldıkları yerde `#podMask` ile gizlenir; çizimin viewBox'ı, sol ön pervane dönerken taşmayacak kadar sola genişletilmiştir.
- **Tasarım** bölümü (`#teknik-resim`): 4+1 VTOL düzeninin kısa anlatımı, açılır boyut tablosu ve kuyruk seçimi (ters V çift bom, gerekçesiyle). Teknik resmin çizim sayfaları siteye konmaz; kuyruk seçeneklerinin küçük çizimleri satır içi SVG'dir.
- Hareketler `src/home.js` içindedir: bölümler ekrana girmeden hemen önce kısa bir geçişle belirir, giriş çizimindeki uçak kaydırdıkça yükselir. Sistemde "hareketi azalt" seçiliyse hiçbiri çalışmaz.
- **Nasıl uçar?** (`#nasil-ucar`, `src/flight.js`, `src/flight3d.js`): sayfa kaydıkça uçak beş evreden geçer (dikey kalkış, geçiş, seyir, geri geçiş, dikey iniş); çalışan motorlar yanda gösterilir. Sahne sabit kameralı 3B'dir (three.js, bölüm yaklaşınca yüklenir); yüklenene kadar ya da WebGL yoksa aynı akışın 2B SVG sürümü görünür.
- **3B model** (`#model`, `src/model3d.js`): teknik resim ölçüleriyle kurulmuş, döndürülebilir model. Uçağın geometrisi ve renkleri `src/aircraft3d.js` içindedir; iki 3B sahne de bunu kullanır.
- **Görev haritası** (`#gorev`, `src/mission.js`): temsili görevde rota, yasak bölgelerden kaçınma ve arama alanı taraması.
- Sayılar (ağırlık, batarya, hız, uçuş süresi) tanıtım PDF'inden, uçağın geometrisi teknik resimden alınır; ilk uçağın değerleri yeni uçak için kullanılmaz. Takım kararı (Kasım 2026): seyir hızı 17 m/s, hedef kalkış ağırlığı 6 kg; teknik resimdeki 8 kg ve 20 m/s varsayımdır.
- Henüz eklenmeyenler: güncel malzeme listesi, atölye fotoğrafları.

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173 (ilk uçak: /ilk-ucak.html)
npm run build    # iki sayfayı da dist/ klasörüne üretir
```

Formüller `ilk-ucak.html` içinde TeX olarak yazılır (`<span class="tex">…</span>`) ve derleme sırasında KaTeX ile MathML'e çevrilir; tarayıcıya matematik kütüphanesi gönderilmez.

## Yayınlama (GitHub Pages)

`.github/workflows/deploy.yml` siteyi derleyip GitHub Pages'e yükler. Yalnızca siteyi etkileyen dosyalar değiştiğinde çalışır (sayfalar, `src/`, `public/`, paket dosyaları, `vite.config.js` ve iş akışının kendisi); README veya `docs/` değişiklikleri derleme başlatmaz.

- `main`'e push: derler ve yayınlar.
- Pull request: yalnızca derlemeyi doğrular.
- Elle çalıştırma: Actions sekmesinden **Run workflow**.

İlk kurulumda bir kez: **Settings → Pages → Build and deployment → Source: GitHub Actions** seçilmelidir.

## Katkı

Değişiklikler `ysoktar/ikarus` çatalında bir dalda yapılır ve pull request ile `ROGOYATO/ikarus`'un `main` dalına birleştirilir.
