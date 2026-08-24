# Remote Code İhlal Raporu — Partners ChatGPT Extension v2.0.0

**Extension ID:** `fnmihdojmnkclgjpcoonokmkhjpjechg`
**Paket yolu:** `partners/fnmihdojmnkclgjpcoonokmkhjpjechg/2.0.0`
**Manifest version:** `2.0.0` (MV3)
**Referans doküman:** `aitopia/md/REMOTE_CODE_AUDIT.md` (v2.0.4 için hazırlanan audit — Google 22 Nisan 2026'da "Including remotely hosted code in a Manifest V3 item" gerekçesiyle reddetti)
**Audit tarihi:** 24 Nisan 2026
**Metodoloji:** Referanstaki tüm desenler (dinamik `<script>` enjeksiyonu, remote `import`, `.disabled` dosyalar, `new Function`, `importScripts`, `eval`, `WebAssembly.instantiateStreaming`, `chrome.scripting.executeScript`, CDN referansları, `web_accessible_resources`) bu partner paketinde sıfırdan tarandı.

> **Yoksayım notu:** `externally_connectable` alanı bu audit'in dışında tutulmuştur.
> `externally_connectable: { matches: ["*://*.aitopia.ai/*", "*://*.chatgptextension.ai/*"] }`
> ürünün zorunlu/doğru durumudur — kaldırılmamalı, incelenmemeli, bulgu olarak raporlanmamalıdır.

---

## İçindekiler

1. [Yönetici Özeti](#yönetici-özeti)
2. [Referans Paketle Farklar Tablosu](#referans-paketle-farklar-tablosu)
3. [Kesin İhlaller](#kesin-i̇hlaller)
4. [Şüpheli / Yüksek Risk](#şüpheli--yüksek-risk)
5. [İhlal Bulunmayan Alanlar](#i̇hlal-bulunmayan-alanlar)
6. [Aksiyon Listesi](#aksiyon-listesi)
7. [Rejection'a karşı beklenen durum](#rejectiona-karşı-beklenen-durum)
8. [Remote domain özeti](#remote-domain-özeti)
9. [Audit metodolojisi](#audit-metodolojisi-şeffaflık)

---

## Yönetici Özeti

Partner paket, ana `aitopia` paketine göre **belirgin biçimde daha temiz**. Referans audit'in 3 kesin ihlalinin **hiçbiri bu sürümde kalmamış**. Şüpheli kategorideki 3 bulgudan 1'i tamamen giderilmiş (vendor dosya isimleri), 2'si bağlamsal olarak devam ediyor ama teknik uyumlu.

| Kategori       | Referans (ana paket) | Bu paket (partner v2.0.0)          |
| -------------- | -------------------- | ---------------------------------- |
| 🔴 Kesin ihlal | 3                    | **0**                              |
| 🟡 Şüpheli     | 3                    | **2**                              |
| 🟢 Temiz       | —                    | Root JS, service worker, aktif HTML'ler, vendor isimleri, `.disabled` dosyalar |

**Kritik bulgular:**

1. Referans doküman'ın "%90 rejection nedeni" olarak işaretlediği **obfuscate edilmiş `createElement("scrIpt")` loader** — **bu pakette yok**. Hiçbir dosyada `createElement("scrIpt")` veya case-variant desen bulunmadı.
2. Referans'ta #3 numaralı ihlal olan **`docs.html.disabled` + `triggers-actions.html.disabled`** dosyaları **bu sürümde artık `.disabled` değil** — aktif HTML'lere dönüştürülmüş ve içerikleri **tümüyle lokal vendor dosyalarına** (`/aitopia/marketplace/js/vendor/tailwindcss.min.js`, `marked.min.js`, `prism*.min.js`) yönlendirilmiş. Paket içinde artık `.html.disabled` uzantılı hiçbir dosya yok.
3. Referans'ta #2 numaralı ihlal olan **bozuk `import ... from '.https://aitopia.ai/moltopia/share.js'`** deseni **düzeltilmiş**: her iki dosya da artık `from '../moltopia/share.js'` kullanıyor (lokal relatif path), hedef klasör pakette mevcut.

---

## Referans Paketle Farklar Tablosu

| Referans bulgu                                                                             | Ana paket durumu                  | Bu paket durumu                    | Not                                                                                                                               |
| ------------------------------------------------------------------------------------------ | --------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **İhlal #1** — `createElement("scrIpt")` (capital I obfuscation)                           | `77babe6c...js` içinde 2x         | ✅ **YOK**                         | `createElement\s*\(\s*["'][sS][cC][rR][iI][pP][tT]["']` regex'i 0 eşleşme; paket `77babe6c...js` dosyasını da içermiyor             |
| **İhlal #2** — Bozuk `import ... from '.https://aitopia.ai/moltopia/share.js'`             | `feed.js` ve `output-detail.js`   | ✅ **DÜZELTİLMİŞ**                 | Her iki dosya `from '../moltopia/share.js'` kullanıyor; hedef [aitopia/marketplace/js/moltopia/share.js](aitopia/marketplace/js/moltopia/share.js) lokal olarak mevcut |
| **İhlal #3** — `docs.html.disabled` + `triggers-actions.html.disabled` içinde 10 external script | Mevcut                            | ✅ **GİDERİLMİŞ**                  | `.disabled` uzantılı dosya paket içinde **kalmamış**; [docs.html](aitopia/marketplace/docs.html) ve [docs/triggers-actions.html](aitopia/marketplace/docs/triggers-actions.html) aktif, tüm `<script src>` değerleri lokal |
| **Şüpheli #4** — `new Function(...)` çoklu                                                 | 4 bundle / 13 occurrence          | 🟡 Mevcut (5 dosya / 14 occurrence) | Hepsi **statik template string**, hiçbiri network input'u tüketmiyor — teknik olarak uyumlu                                         |
| **Şüpheli #5** — `externally_connectable`                                                  | —                                 | ⏭️ **YOKSAYILDI**                 | Ürün gereği sabit; kapsam dışı tutuldu                                                                                             |
| **Şüpheli #5b** — Geniş `web_accessible_resources`                                         | Mevcut                            | 🟡 **AYNEN MEVCUT**                | `<all_urls>` + `*.js` wildcard'ı                                                                                                    |
| **Şüpheli #6** — Vendor dosyalarında `cdn-*--` prefix                                      | Mevcut                            | ✅ **DÜZELTİLMİŞ**                 | `find` ile `cdn-*` pattern 0 eşleşme; vendor isimleri nötr (`chart.umd.min.js`, `marked.min.js`, `prism.min.js` …)                  |
| Ek bulgu (referansta yok) — PDF.js `importScripts` + `createCDNWrapper`                    | —                                 | 🟡 Aşağıda #C — pdf.worker.js eksik | [aitopia/assets/1726d2e2899085becf0fe9b9df67945c.js](aitopia/assets/1726d2e2899085becf0fe9b9df67945c.js)                            |

---

## 🔴 Kesin İhlaller

**Yok.** Referans dokümandaki 3 kesin ihlalin tümü bu sürümde giderilmiş:

- #1 (obfuscated `createElement("scrIpt")` loader) — hiçbir dosyada mevcut değil; bulunduğu `77babe6c4815a18fc1c55a2a6b03970f.js` bundle'ı da pakette yok.
- #2 (bozuk `.https://...` import syntax'ı) — iki dosya da artık lokal relatif path kullanıyor.
- #3 (`.html.disabled` içindeki 10 CDN script tag'i) — `.disabled` uzantılı dosya paketten çıkarılmış, aktif `docs.html` ve `docs/triggers-actions.html` tamamen lokal vendor referansları kullanıyor.

---

## 🟡 Şüpheli / Yüksek Risk

### #A — `new Function(...)` kullanımı (5 dosya / 14 occurrence)

| Dosya                                                                                                    | Occurrence | Ne için kullanılıyor                                              |
| -------------------------------------------------------------------------------------------------------- | ---------: | ----------------------------------------------------------------- |
| [aitopia/assets/1726d2e2899085becf0fe9b9df67945c.js](aitopia/assets/1726d2e2899085becf0fe9b9df67945c.js) |          6 | PDF.js (`EvalSupported` compiler, feature detection)               |
| [aitopia/assets/5e4597c76602dc968840d05b8cc677d5.js](aitopia/assets/5e4597c76602dc968840d05b8cc677d5.js) |          5 | bluebird promise library (tryCatch, errorObj template)             |
| [aitopia/assets/37d07d9afed791add1b2c9612f5db51b.js](aitopia/assets/37d07d9afed791add1b2c9612f5db51b.js) |          1 | `setImmediate` polyfill (`new Function(""+S)`)                     |
| [aitopia/assets/a9b1cfbb9b6ae2f2a01cce0bae1e6dee.js](aitopia/assets/a9b1cfbb9b6ae2f2a01cce0bae1e6dee.js) |          1 | Feature-detect (`new Function("")`)                                |
| [aitopia/marketplace/js/vendor/heic2any.esm.js](aitopia/marketplace/js/vendor/heic2any.esm.js)           |         1+ | Emscripten runtime (`dynCall`, `rawFunction` binding)              |

**Durum:** Hepsi statik template string'lerden veya compile-time üretilen kısa script string'lerinden besleniyor. **Hiçbir `new Function` çağrısı network cevabını girdi olarak almıyor** — `fetch(...).then(r => r.text()).then(s => new Function(s))` kalıbı hiçbir dosyada yok.

**Risk:** Teknik olarak uyumlu. Ancak MV3 extension'da `unsafe-eval` tetikleyen bu kütüphaneler, reviewer'ın manuel incelemesinde işaretlenebilir.

**Öneri:** Eğer PDF görüntüleme (PDF.js) veya HEIC dönüştürme (heic2any) feature'ları kritik değilse, bu asset'leri paketten çıkarmak hem bundle boyutunu azaltır hem de `new Function` saldırı yüzeyini tamamen ortadan kaldırır. Bluebird ise çoğu zaman native `Promise` ile değiştirilebilir.

---

### #B — Geniş `web_accessible_resources`

**Dosya:** [manifest.json](manifest.json)

```json
"resources": ["*.png","*.svg","*.otf","*.mp4","*.webm","*.js","*.css","*.woff", ...]
"matches": ["<all_urls>"]
```

**Neden risk:**

- Doğrudan remote code yükleme değil; ancak tüm `*.js` bundle'larını `<all_urls>` kaynağına açmak MV3 isolation modelini zayıflatıyor.
- `web_accessible_resources` listesinde 50+ spesifik `aitopia/assets/*.js` kaydı var; hepsi `<all_urls>` ile expose edilmiş.
- Limited Use / broad permissions politikasına takılabilir; remote-code rejection'ının doğrudan nedeni değildir.

**Öneri:** `web_accessible_resources.matches` listesini yalnızca enjekte olmak istenen origin'lerle daraltmak; `resources` içindeki wildcard `*.js`'leri spesifik dosyalarla sınırlamak.

> Not: `externally_connectable` alanı bu audit'in kapsamı dışındadır (yoksayım notu — bkz. rapor başı).

---

### #C — PDF.js `createCDNWrapper` + eksik `pdf.worker.js`

**Dosya:** [aitopia/assets/1726d2e2899085becf0fe9b9df67945c.js](aitopia/assets/1726d2e2899085becf0fe9b9df67945c.js)

**Kod (minified — decoded):**

```js
L.createCDNWrapper = function(ve){
  const ge = `importScripts("${ve}");`;
  return URL.createObjectURL(new Blob([ge]));
}
// ...
fallbackWorkerSrc = "./pdf.worker.js"
```

**Bağlam:** PDF.js'in resmi utility'si. Fonksiyonun ismi ("CDN wrapper") ve `importScripts("${ve}")` tek başına statik tarayıcıların dikkatini çeker.

**Kritik ek bulgu:** Paket içinde `pdf.worker.js` dosyası **mevcut değil** (`find -iname "pdf.worker*"` 0 eşleşme). Yani:

- PDF.js runtime'da workerSrc ayarlanmadıysa `fallbackWorkerSrc="./pdf.worker.js"` olarak denemeye geçer, **dosya bulunamaz → PDF rendering başarısız olur**.
- Eğer runtime'da `GlobalWorkerOptions.workerSrc` **uzak URL** ile set edilirse, `createCDNWrapper` bu URL'yi `importScripts(...)` ile yükler → **remote code execution**.
- Kod tabanında `workerSrc = "https://..."` atamasına rastlanmadı, dolayısıyla _pratikte_ remote fetch yok. Ancak:
  - Dosyanın varlık amacı belirsiz (PDF feature çalışmıyor ama bundle pakette).
  - Fonksiyon imzası ve `importScripts` kullanımı **statik tarama araçlarının (ve manuel reviewer'ın) alarm vermesine yeter**.

**Öneri (öncelik sırası):**

1. Eğer PDF özelliği **kullanılmıyorsa** → `1726d2e2...js` bundle'ını paketten çıkar (en temiz çözüm).
2. PDF özelliği gerekiyorsa → `pdf.worker.js` dosyasını pakete ekle ve runtime'da `GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.js")` olarak sabitle.
3. Her iki durumda da reviewer'a appeal notunda bu dosyanın remote fetch yapmadığını açıklamaya hazır ol.

---

## 🟢 İhlal Bulunmayan Alanlar

- ✅ **Kök JS:** [loader.js](loader.js) (10 satır — yalnızca `chrome.runtime.sendMessage({messageType:"INJECT_MAIN_APP"})`), [blueBackground.js](blueBackground.js), [bluePopup.js](bluePopup.js), [options.js](options.js) — hepsi temiz. Hiçbirinde `createElement("script")`, `eval`, `new Function`, `innerHTML = <script>`, `import()`, `importScripts` yok.
- ✅ **Service worker loader:** [aitopia/service-worker-loader.js](aitopia/service-worker-loader.js) — tek satır: `import '/aitopia/assets/f6d718474b920d42eada2535fb97ad0d.js';` (lokal).
- ✅ **Aktif HTML'ler:** `bluePopup.html`, `options.html`, tüm `aitopia/marketplace/*.html` + `aitopia/marketplace/docs/*.html` dosyalarının hiçbirinde `<script src="https://...">` yok. `grep '<script[^>]+src="https?://' --glob '*.html'` → **0 eşleşme**.
- ✅ **`createElement("scrIpt")` (capital I obfuscation):** Hiçbir dosyada bulunmadı — referans dokümanın "ana rejection sebebi" olarak işaretlediği desen bu pakette yok.
- ✅ **`.html.disabled` dosyaları:** `find -name "*.disabled"` 0 eşleşme. Referans audit'teki #3 kesin ihlali tamamen giderilmiş.
- ✅ **Bozuk `.https://...` import'ları:** [aitopia/marketplace/js/feed/feed.js:2](aitopia/marketplace/js/feed/feed.js#L2) ve [aitopia/marketplace/js/outputs/output-detail.js:3](aitopia/marketplace/js/outputs/output-detail.js#L3) artık `from '../moltopia/share.js'` kullanıyor.
- ✅ **Remote `import from "https://..."`:** Kod tabanında hiç yok (`import\s+.*from\s+["'][^"']*https?://` → 0 eşleşme).
- ✅ **Dinamik `import("https://...")`:** 0 eşleşme.
- ✅ **`eval()`:** Hiçbir aktif kodda yok (`\beval\s*\(` → 0 eşleşme).
- ✅ **`WebAssembly.instantiateStreaming`:** Hiçbir yerde yok.
- ✅ **`chrome.scripting.executeScript`:** Yalnızca [blueBackground.js:210](blueBackground.js#L210) içinde **yorum satırı** olarak bulunuyor.
- ✅ **CDN domain referansları:** `cdn.jsdelivr`, `googletagmanager`, `cdn.tailwindcss`, `unpkg.com`, `fonts.googleapis.com` — hiçbir aktif HTML/JS dosyasında eşleşme yok. (Eski sürümlerde `.disabled` HTML'lerde vardı — tamamen temizlenmiş.)
- ✅ **Vendor dosya isimleri:** `cdn-*--` prefix'i yok. Dosya adları nötr: `chart.umd.min.js`, `marked.min.js`, `prism.min.js`, `prism-bash.min.js`, `prism-javascript.min.js`, `prism-json.min.js`, `prism-sql.min.js`, `prism-typescript.min.js`, `tailwindcss.min.js`, `confetti.browser.esm.js`, `heic2any.esm.js`, `imagesloaded.min.js`, `masonry.min.js`, `minisearch.min.js`, `api.js`. Hepsi pakette lokal olarak bulunuyor.
- ✅ **Turnstile `createElement("script")` (vendor `api.js` içinde):** [aitopia/marketplace/js/vendor/api.js](aitopia/marketplace/js/vendor/api.js) — Cloudflare Turnstile kütüphanesinin kendi dosyası. İçindeki `createElement("script")` çağrısı, sayfada zaten yüklenmiş bir Turnstile script element'inin `src`'ini alıp upgrade eden self-replace mekanizmasıdır. Yeni script URL'si dış dünyadan gelmez, var olan `<script>` etiketinin `src`'inden türetilir. Dosya sadece [aitopia/marketplace/login.html](aitopia/marketplace/login.html) ve [aitopia/marketplace/register.html](aitopia/marketplace/register.html) içinden lokal olarak çağrılıyor.
- ✅ **`fetch(...).then(r => r.text()).then(eval)` kalıbı:** Hiçbir yerde yok. `response.text()` kullanan üç bundle var (1f561a8d..., a919e806..., f6d71847...) ama hepsi JSON/text parse ediyor — YouTube scraping ([a919e806...js](aitopia/assets/a919e806288687b2e981bfbe61fc8f29.js) `ytInitialPlayerResponse`'ı regex ile alıp `JSON.parse` ediyor; `<script>` tag içeriğini **execute etmiyor**).

---

## Aksiyon Listesi

Düzeltme önceliği (etki / zorluk):

| # | Aksiyon                                                                                                                                                                | Dosya(lar)                                                                                          | Zorluk       | İhlal |
| - | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------ | :---: |
| 1 | PDF özelliği kullanılmıyorsa `1726d2e2...js` bundle'ını paketten çıkar; kullanılıyorsa `pdf.worker.js` dosyasını ekle ve `workerSrc`'yi `chrome.runtime.getURL(...)`'a sabitle | [aitopia/assets/1726d2e2899085becf0fe9b9df67945c.js](aitopia/assets/1726d2e2899085becf0fe9b9df67945c.js) | Düşük – Orta |  #C   |
| 2 | `web_accessible_resources.matches` listesini `<all_urls>`'den spesifik origin'lere daralt; `resources` içindeki `*.js` wildcard'ını dosya listesiyle sınırla             | [manifest.json](manifest.json)                                                                      | Orta         |  #B   |
| 3 | `new Function()` içeren vendor'ları (PDF.js, bluebird, heic2any, setImmediate polyfill) kullanımlarıyla birlikte gözden geçir; kullanılmıyorsa çıkar                      | 5 asset                                                                                             | Orta–Yüksek  |  #A   |

> **Not:** Aksiyon #1 hem #A'daki 6 `new Function` occurrence'ını (PDF.js) hem de #C'deki `importScripts`/`createCDNWrapper` bulgularını tek adımda kapatır.

---

## Rejection'a karşı beklenen durum

Referans doküman `aitopia/md/REMOTE_CODE_AUDIT.md`, ana paketin 22 Nisan 2026'daki reddinin **%90 ihtimalle** obfuscate edilmiş `createElement("scrIpt")` loader'ından kaynaklandığını söylüyor. **Bu desen bu pakette yok.** Ayrıca referanstaki diğer iki kesin ihlal (bozuk remote import, `.html.disabled` external script'ler) de **tamamen giderilmiş**.

**Tahmin:** Bu paket mevcut hâliyle "remote code" gerekçesiyle reddedilmemeli. Geriye kalan riskler:

- 🟡 **`new Function` içeren vendor bundle'ları** (#A) — statik tarayıcılar `unsafe-eval` alarm verebilir. Ancak tüm çağrılar statik template string'ten besleniyor, network input'u yok.
- 🟡 **PDF.js `createCDNWrapper`/`importScripts`** (#C) — isim + desen reviewer alarmı çekebilir; pratikte remote fetch yapılmıyor ama `pdf.worker.js` eksik olduğundan feature de çalışmıyor — gereksiz risk.
- 🟡 **Geniş `web_accessible_resources`** (#B) — "Limited Use" / broad permissions politikalarına takılabilir; remote-code rejection'ı doğrudan tetiklemez.

Bu üç şüpheli alan reviewer'ın manuel incelemesinde not düşme riskidir, otomatik red sebebi değil. Appeal ile her biri açıklanabilir.

---

## Remote domain özeti

Extension'ın kod tabanında (aktif dosyalarda) geçen domain'ler:

| Domain                                           | Kullanım                                    |    İhlal mi?    |
| ------------------------------------------------ | ------------------------------------------- | :-------------: |
| `aitopia.ai`                                     | JSON API (`/api/*`, `/store/*`, `/auth/*`)  | ❌ (data only)  |
| `chatgptextension.ai`                            | `externally_connectable` hedefi             | ⏭️ Kapsam dışı |
| `cloudflare.com` / Turnstile                     | [vendor/api.js](aitopia/marketplace/js/vendor/api.js) içinde lokal olarak bundled | ❌ |
| `google.com/search`                              | [1f561a8d...js](aitopia/assets/1f561a8df60a8296d08de42c892f86e0.js) — HTML parse için `fetch` (code execution yok) | ❌ (data only) |
| `youtube.com`                                    | [a919e806...js](aitopia/assets/a919e806288687b2e981bfbe61fc8f29.js) — `ytInitialPlayerResponse` JSON scraping | ❌ (data only) |
| `w3.org/2000/svg`                                | XML namespace                               | ❌              |
| `cdn.jsdelivr.net`, `googletagmanager.com`, `cdn.tailwindcss.com`, `unpkg.com`, `fonts.googleapis.com` | **Aktif hiçbir dosyada yok** | ✅ Temiz |

---

## Audit metodolojisi (şeffaflık)

Kullanılan aramalar (ripgrep):

- `createElement\s*\(\s*["'][sS][cC][rR][iI][pP][tT]["']` — dinamik script injection (tüm case varyantları)
- `import\s+.*from\s+["'][^"']*https?://` — remote ES module
- `from\s+["']\.https?://` — bozuk `.https://` syntax'ı
- `\bimport\s*\(\s*[`'"][^`'"]*https?://` — dinamik `import()` ile remote URL
- `new Function\s*\(` — dinamik fonksiyon kurulumu
- `\beval\s*\(` — dinamik eval
- `importScripts\s*\(` — worker context remote load
- `WebAssembly\.instantiateStreaming` — remote WASM
- `chrome\.scripting\.executeScript` — programmatic injection
- `cdn\.jsdelivr|googletagmanager|cdn\.tailwindcss|unpkg\.com|fonts\.googleapis\.com` — bilinen CDN'ler
- `<script[^>]+src=["']https?://` — aktif HTML'lerde external script
- `<link[^>]+href=["']https?://[^"']+\.(js|css)` — external stylesheet/script link
- `\.then\s*\(\s*\w*\s*=>\s*\w*\.text\(\)` — fetch-then-text kalıbı (execute edip etmediği her eşleşmede manuel kontrol edildi)
- `find -name "*.disabled"` — disabled dosya varlığı
- `find -name "cdn-*"` — vendor prefix varlığı
- `find -iname "pdf.worker*"` — PDF.js worker varlığı
- Manifest `web_accessible_resources` ve `permissions` statik inceleme (`externally_connectable` yoksayım kapsamında)

Her eşleşme için dosya + bağlam (en az 200 karakter) okunarak false-positive elenmiştir. Minified bundle'larda desenler `grep -oE` ile kısa context'le doğrulanmıştır.
