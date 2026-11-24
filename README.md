# siha-final-rapor

İKARUS takımının web sitesi. Üst çubuktaki **Uçaklarımız** menüsü iki sayfa arasında geçiş yapar:

- `index.html`: yeni uçağımız (SUAS 2027). İçerik ve görsel dil `docs/` altındaki tanıtım dokümanını izler; logo ve uçak çizimi o PDF'ten çıkarılmış SVG'lerdir.
- `ilk-ucak.html`: ilk uçağımızın **TEKNOFEST 2026 Savaşan İHA Yarışması Kritik Tasarım Raporu**'nun etkileşimli sürümü. Eski `#s…` bağlantıları ana sayfadan buraya yönlendirilir.

İlk uçağın sayfası rapor metnini, tablolarını, formüllerini ve şekillerini toplar. Ek olarak:

- Uçuş süresi hesaplayıcı (3.2.1), bütçe karşılaştırması (2.2)
- Alt sistem ağırlık merkezi grafiği ve sıralanabilir tablo (3.4)
- Kilitlenme zinciri, APF grid + A* rota simülasyonu, IBVS / kilitlenme dörtgeni demosu (4.1)
- Kamikaze dalış profili, G yükü ve QR piksel yoğunluğu hesapları (4.2)
- Haberleşme bağlantı haritası ve YKİ sekmeleri (6)
- Jetson çıkarım karşılaştırma grafiği ve işaretlenebilir uçuş kontrol listesi (8)

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ klasörüne üretir
```

Formüller `ilk-ucak.html` içinde TeX olarak yazılır (`<span class="tex">…</span>`) ve derleme sırasında KaTeX ile MathML'e çevrilir; tarayıcıya matematik kütüphanesi gönderilmez. Görseller `public/img/` altındadır (WebP).

## Yayınlama (GitHub Pages)

`.github/workflows/deploy.yml`, `main` dalına her push'ta siteyi derleyip GitHub Pages'e yükler; pull request'lerde yalnızca derlemeyi doğrular.

İlk kurulumda bir kez: **Settings → Pages → Build and deployment → Source: GitHub Actions** seçilmelidir.
