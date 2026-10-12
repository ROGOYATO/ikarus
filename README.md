# siha-final-rapor

İKARUS takımının **TEKNOFEST 2026 Savaşan İHA Yarışması Kritik Tasarım Raporu**'nun etkileşimli web sürümü.

Rapor metni, tabloları, formülleri ve şekilleri tek sayfada toplanmıştır. Ek olarak:

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

Formüller `index.html` içinde TeX olarak yazılır (`<span class="tex">…</span>`) ve derleme sırasında KaTeX ile MathML'e çevrilir; tarayıcıya matematik kütüphanesi gönderilmez. Görseller `public/img/` altındadır (WebP).

## Yayınlama (GitHub Pages)

`.github/workflows/deploy.yml`, `main` dalına her push'ta siteyi derleyip GitHub Pages'e yükler; pull request'lerde yalnızca derlemeyi doğrular.

İlk kurulumda bir kez: **Settings → Pages → Build and deployment → Source: GitHub Actions** seçilmelidir.
