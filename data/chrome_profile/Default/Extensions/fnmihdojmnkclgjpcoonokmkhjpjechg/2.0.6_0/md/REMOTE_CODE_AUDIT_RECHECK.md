# Remote Code İhlal Raporu — Yeniden Analiz (Partner v2.0.0)

**Extension ID:** `fnmihdojmnkclgjpcoonokmkhjpjechg`
**Paket yolu:** `partners/fnmihdojmnkclgjpcoonokmkhjpjechg/2.0.0`
**Manifest version:** `2.0.0` (MV3)
**Önceki audit:** [REMOTE_CODE_AUDIT.md](REMOTE_CODE_AUDIT.md) (23 Nisan 2026 — partner paketi için)
**Referans audit:** `aitopia/md/REMOTE_CODE_AUDIT.md` (ana paket v2.0.4, 22 Nisan 2026 reddi)
**Bu yeniden analizin tarihi:** 24 Nisan 2026
**Kapsam:** Referans metodolojinin (dinamik `<script>` enjeksiyonu, remote `import`, `.disabled` içerik, `new Function`, `importScripts`, `eval`, `web_accessible_resources`, fetch-then-eval) mevcut paket durumu üzerinde **sıfırdan** yeniden uygulanması.

> **Yoksayım notu:** `externally_connectable` alanı kapsam dışı. Manifest'teki
> `externally_connectable: { matches: ["*://*.aitopia.ai/*", "*://*.chatgptextension.ai/*"] }`
> tanımı ürünün zorunlu/doğru durumudur.

---

## İçindekiler

1. [Yönetici Özeti](#yönetici-özeti)
2. [Önceki Audit ile Farklar](#önceki-audit-ile-farklar)
3. [Kesin İhlaller](#kesin-i̇hlaller)
4. [Şüpheli / Yüksek Risk](#şüpheli--yüksek-risk)
5. [İhlal Bulunmayan Alanlar](#i̇hlal-bulunmayan-alanlar)
6. [Aksiyon Listesi](#aksiyon-listesi)
7. [Rejection'a karşı beklenen durum](#rejectiona-karşı-beklenen-durum)
8. [Remote domain özeti](#remote-domain-özeti)
9. [Audit metodolojisi](#audit-metodolojisi)

---

## Yönetici Özeti

Paket, önceki audit'e (23 Nisan) göre **belirgin biçimde iyileşmiş**. Referans audit'in ana paket v2.0.4'te bulduğu 3 kesin ihlalin **tamamı bu partner paketinde yok veya giderilmiş**. Önceki audit'in tek kalan kesin ihlal olarak gösterdiği `.html.disabled` dosyaları (referans #3) da **artık silinmiş/aktifleştirilmiş ve içerikleri lokal vendor dosyalarına çevrilmiş**.

| Kategori | Referans (ana paket v2.0.4) | Önceki audit (partner v2.0.0, 23 Nisan) | Bu audit (partner v2.0.0, 24 Nisan) |
|---|---|---|---|
| 🔴 Kesin ihlal | 3 | 1 | **0** |
| 🟡 Şüpheli / Yüksek Risk | 3 | 2 | **3** |
| 🟢 Temiz | — | Root JS, SW, aktif HTML'ler, vendor isimleri | Root JS, SW, aktif HTML'ler, vendor isimleri, `.html.disabled` yok, `.https://` import yok |

**Kritik bulgular:**

1. ✅ Referans "%90 rejection sebebi" olarak gösterilen **obfuscate edilmiş `createElement("scrIpt")`** deseni (`scr[Ii]pt` regex'i) — hiçbir dosyada yok.
2. ✅ Referans #2 (`from '.https://aitopia.ai/moltopia/share.js'`) — [feed.js:2](aitopia/marketplace/js/feed/feed.js#L2) ve [output-detail.js:3](aitopia/marketplace/js/outputs/output-detail.js#L3) artık lokal relatif path (`../moltopia/share.js`) kullanıyor.
3. ✅ Referans #3 (`.html.disabled` dosyaları) — **pakette `.disabled` uzantılı hiçbir dosya yok** (`Glob **/*.disabled` boş döndü). Bunun yerine [docs.html](aitopia/marketplace/docs.html) ve [docs/triggers-actions.html](aitopia/marketplace/docs/triggers-actions.html) aktif HTML olarak var ve içindeki CDN `<script src>` tag'leri **tamamen lokal `/aitopia/marketplace/js/vendor/*` referanslarına çevrilmiş**.
4. 🟡 Yeni şüpheli alan: Vue render fonksiyonlarının içinden runtime'da `<link href="https://fonts.googleapis.com/css2?...">` enjeksiyonu (6 asset'te) + [aitopia/assets/css/fonts.css:1](aitopia/assets/css/fonts.css#L1) üzerinden aktif `@import url('https://fonts.googleapis.com/...')` — CSS remote yüklemesi (Google'ın remote-code politikasının kapsamı DEĞİL ama reviewer dikkatini çeker).

---

## Önceki Audit ile Farklar

| Önceki audit bulgusu | Durum | Not |
|---|---|---|
| **İhlal #A** — `.html.disabled` dosyalarında 10 external `<script src>` | ✅ **KAPATILDI** | `.disabled` uzantısı tüm pakette **bulunamadı**; `docs.html` aktif hale getirilmiş ve içindeki 10 external CDN script lokal vendor dosyalarına çevrilmiş |
| **Şüpheli #B** — `new Function(...)` (5 dosya / 14 occurrence) | 🟡 Değişmedi | Dosya hash'leri değişmiş (`abbbebe54...` → `2df260c56...` vb.) ama desen aynı: bluebird, PDF.js, polyfill'ler, heic2any. Statik template, network input yok |
| **Şüpheli #C** — Geniş `web_accessible_resources` | 🟡 Değişmedi | `<all_urls>` + `*.js` wildcard'ı hâlâ var; `resources` listesi 50+ özel asset dahil |
| **Şüpheli #D** — PDF.js `createCDNWrapper` + `importScripts` | 🟡 Değişmedi (hash farklı) | Artık [aitopia/assets/68ac5a57db35018d532b857bb6626a9c.js:1](aitopia/assets/68ac5a57db35018d532b857bb6626a9c.js) ve satır 66. `fallbackWorkerSrc = "./pdf.worker.js"` — **ama `pdf.worker.js` pakette YOK** (aşağıda detay) |
| (yeni bulgu) | 🟡 **YENİ** | `aitopia/assets/css/fonts.css` — aktif `@import url('https://fonts.googleapis.com/css2?...')` + 6 Vue asset'inde runtime `<link href="fonts.googleapis.com">` enjeksiyonu |

---

## 🔴 Kesin İhlaller

**YOK.** Google'ın "remote hosted code" rejection kriterine tam uyan hiçbir aktif desen tespit edilmedi:

- ❌ `createElement("script")` / `createElement("scrIpt")` — sadece vendor [api.js (Cloudflare Turnstile)](aitopia/marketplace/js/vendor/api.js) içinde, self-upgrade mekaniği (yeni `src`, sayfada zaten yüklenmiş Turnstile script'inin `src`'inden türetiliyor). Extension kodu dışarıdan URL enjekte etmiyor.
- ❌ `import ... from "https://..."` — grep 0 eşleşme.
- ❌ `<script src="https://...">` — tüm aktif ve `.disabled` HTML'lerde 0 eşleşme.
- ❌ `eval(` — 0 eşleşme.
- ❌ `WebAssembly.instantiateStreaming` — 0 eşleşme.
- ❌ `.then(r => r.text()).then(eval)` — 0 eşleşme.
- ❌ `innerHTML = "...<script..."` — 0 eşleşme (yalnızca PDFObject'in kendi iframe+write kalıbı var, ki o da script URL'i yüklemiyor).
- ❌ `.disabled` uzantılı dosya — `Glob **/*.disabled` boş.

---

## 🟡 Şüpheli / Yüksek Risk

### #1 — `new Function(...)` kullanımı (5 dosya / ~14 occurrence)

| Dosya | Occurrence | Ne için |
|---|---:|---|
| [aitopia/assets/2df260c56f1ecc2966eddcfc1eda0f15.js](aitopia/assets/2df260c56f1ecc2966eddcfc1eda0f15.js) | 1 (min'd, asıl daha fazla) | Template compiler (`new Function(f,"_",u)`) — statik template string |
| [aitopia/assets/68ac5a57db35018d532b857bb6626a9c.js](aitopia/assets/68ac5a57db35018d532b857bb6626a9c.js) | ~6 | PDF.js — `EvalSupported` feature detection, sandbox expression compiler |
| [aitopia/assets/9651c12c90c0f3910e160343b8391f84.js](aitopia/assets/9651c12c90c0f3910e160343b8391f84.js) | 5 | Bluebird — `tryCatch` / promise hot-path generators (şablon `.replace(/methodName/g,...)`) |
| [aitopia/assets/a6bc4873cd2756feb77fb7a2731c1210.js](aitopia/assets/a6bc4873cd2756feb77fb7a2731c1210.js) | 1 | setImmediate polyfill |
| [aitopia/marketplace/js/vendor/heic2any.esm.js](aitopia/marketplace/js/vendor/heic2any.esm.js) | 1+ | Emscripten `dynCall` runtime |

**Durum:** Tüm `new Function(...)` çağrılarının input'u **statik template string** veya **build-time üretilen short script**. Hiçbir çağrı `fetch` / `XHR` / network cevabını tüketmiyor. Teknik olarak uyumlu.

**Risk:** `unsafe-eval` tetikleyen bu kütüphaneler reviewer'ın manuel incelemesinde işaretlenebilir; referans ana paketin reddinde bu tek başına sebep değil (ana pakette de vardı) ama "kötü niyet görüntüsü" olarak kümülatif etki yaratabilir.

**Öneri:** PDF görüntüleme / HEIC dönüştürme / Bluebird promise kullanılmıyorsa ilgili bundle'ları çıkarmak. Kullanılıyorsa, `new Function` kullanımını açıklayan bir [CSP policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) istisnası gerekir (Google'ın `wasm-unsafe-eval` izin verme politikasına bak).

---

### #2 — PDF.js `createCDNWrapper` + `pdf.worker.js` eksik

**Dosya:** [aitopia/assets/68ac5a57db35018d532b857bb6626a9c.js](aitopia/assets/68ac5a57db35018d532b857bb6626a9c.js)

Dosyada iki ilgili kod parçası var:

```js
// Satır ~1:
L = { isWorkerDisabled: !1, fallbackWorkerSrc: null, fakeWorkerId: 0 };
// ...
L.fallbackWorkerSrc = "./pdf.worker.js";     // Node.js dalı
// ...
L.fallbackWorkerSrc = ve.replace(/(\.(?:min\.)?js)(\?.*)?$/i, ".worker$1$2");  // Browser dalı

// Satır ~66:
createCDNWrapper = function(ve) {
  const ge = `importScripts("${ve}");`;
  return URL.createObjectURL(new Blob([ge]));
}
```

**Kritik bulgu:** `Glob **/pdf.worker*` — **hiçbir dosya bulunamadı**. Yani `fallbackWorkerSrc = "./pdf.worker.js"` lokal fallback'i aslında mevcut olmayan bir dosyaya işaret ediyor.

**Browser dalı ne yapıyor:**
- `document.currentScript.src` alınıp uzantı `.worker.js`'e çevriliyor → aynı origin'deki worker dosyasını arıyor.
- Worker ve script farklı origin'deyse `createCDNWrapper` ile `importScripts("<workerSrc>")` içeren bir Blob URL worker'ı oluşturuluyor.
- `workerSrc` parametresi dış dünyadan alınmıyor; `GlobalWorkerOptions.workerSrc` veya `currentScript.src`'ten türetiliyor.

**Sonuç:**
- PDF feature aktif kullanılırsa: `fallbackWorkerSrc` işe yaramaz (dosya yok), browser currentScript tabanlı türetme tetiklenir → extension asset URL'i döner → same-origin kontrolünü geçerse worker direkt yüklenir, geçmezse `importScripts` wrapper ile same-origin'den çağrılır.
- PDF feature kullanılmıyorsa: bu kod hiç çalışmaz.
- **Dış bir URL (örn. cdn.jsdelivr.net) için execution path YOK** — `workerSrc` dışarıdan verilmedikçe.

**Risk:** Fonksiyon ismi ("CDN wrapper") + `importScripts(<dinamik URL>)` kalıbı statik tarama araçlarının dikkatini çekebilir. Reviewer manuel incelemede kaynağı izlerse `currentScript.src`'e (extension-local) vardığını görür — ihlal değil.

**Öneri:**
1. **Eğer PDF görüntüleme kullanılmıyorsa**: PDF.js bundle'ını (`68ac5a57...js`) tamamen çıkar.
2. **Kullanılıyorsa**: `pdf.worker.js` dosyasını pakete ekle (kök veya `aitopia/assets/` altına) ve `web_accessible_resources`'a kaydet. `GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.js")` ile açıkça set et → `createCDNWrapper` branch'ı hiç çalışmaz.

---

### #3 — `fonts.googleapis.com` aktif remote CSS (referans audit'te ana pakette "temizlenmiş" denmişti, burada **hâlâ aktif**)

**Tür:** Remote **CSS**, remote **JS değil**. Google'ın "remote hosted code" rejection politikasının kapsamında olmayan ama reviewer ve CSP açısından izlenen bir desen.

**Aktif kullanımlar:**

1. **[aitopia/assets/css/fonts.css:1](aitopia/assets/css/fonts.css#L1):**
   ```css
   @import url('https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap');
   ```
   Bu CSS birçok `aitopia/src/html/*.html` sayfasından `<link rel="stylesheet" href="/aitopia/assets/css/fonts.css">` ile çağrılıyor (örn. [agents.html](aitopia/src/html/agents.html), [agent_category.html](aitopia/src/html/agent_category.html), [agent_details.html](aitopia/src/html/agent_details.html), vs — 10+ sayfa).

2. **Vue render fonksiyonlarından runtime `<link>` enjeksiyonu — 6 asset:**
   - [aitopia/assets/417ca6462a7caa745e30c828f3289d42.js](aitopia/assets/417ca6462a7caa745e30c828f3289d42.js)
   - [aitopia/assets/444aab73f76a4b720e0651c4912841a4.js](aitopia/assets/444aab73f76a4b720e0651c4912841a4.js)
   - [aitopia/assets/6f59b05783ab0278fb0a393acd0254a2.js](aitopia/assets/6f59b05783ab0278fb0a393acd0254a2.js)
   - [aitopia/assets/9c2d9b7334ed91fd891a759147dcaf9c.js](aitopia/assets/9c2d9b7334ed91fd891a759147dcaf9c.js)
   - [aitopia/assets/dd73d39d255ba62c667b8448e845ecfd.js](aitopia/assets/dd73d39d255ba62c667b8448e845ecfd.js)
   - [aitopia/assets/feb0e0fec96b482ad7fc1b9f42849ef5.js](aitopia/assets/feb0e0fec96b482ad7fc1b9f42849ef5.js)

   Hepsinde aynı desen:
   ```js
   t("link", { href: "https://fonts.googleapis.com/css2?family=Changa:wght@200..800&display=swap", rel: "stylesheet" }, null, -1)
   ```

**Neden risk:**
- Remote **CSS** olsa da, `content_security_policy.extension_pages` policy'sine uymuyorsa runtime'da bloklanır. MV3'te `style-src` default `'self'` — `fonts.googleapis.com` için manifest'te açıkça izin verilmediyse CSS yüklenmez.
- Reviewer statik analiz yaparken `fonts.googleapis.com` + Vue render injection'u "dışarıdan asset yükleme" olarak işaretleyebilir.
- **Remote code rejection'a yol açmaz** (CSS'te kod yok). Ama policy kapsamında sinyal verir.

**Öneri:** Font dosyalarını lokal olarak paketle (`aitopia/assets/fonts/` altına `.woff2` olarak indir), `fonts.css`'i lokal referanslarla yeniden yaz. Vue render'daki `<link>` injection'u derleme kaynaklarından temizle.

---

## 🟢 İhlal Bulunmayan Alanlar

- ✅ **Kök JS:** [loader.js](loader.js) (10 satır — yalnızca `chrome.runtime.sendMessage`), [blueBackground.js](blueBackground.js), [bluePopup.js](bluePopup.js), [options.js](options.js) — hiçbirinde `createElement("script")`, `eval`, `new Function`, `innerHTML = <script>`, `import()`, `importScripts` yok.
- ✅ **Service worker loader:** [aitopia/service-worker-loader.js](aitopia/service-worker-loader.js) — tek satır, lokal asset import ediyor (`importScripts` *içeriyor* ama parametre lokal ve string sabit).
- ✅ **Aktif HTML'ler:** `bluePopup.html`, `options.html`, tüm `aitopia/marketplace/*.html` — hiçbirinde `<script src="https://...">` yok. Tüm script referansları lokal (`/aitopia/...`).
- ✅ **`.disabled` dosyaları:** Pakette hiç yok (`Glob **/*.disabled` boş).
- ✅ **`createElement("scrIpt")` (capital I obfuscation):** Hiçbir dosyada bulunmadı.
- ✅ **`import ... from "https://..."`:** 0 eşleşme.
- ✅ **Bozuk `.https://...` import'ları:** [feed.js:2](aitopia/marketplace/js/feed/feed.js#L2) ve [output-detail.js:3](aitopia/marketplace/js/outputs/output-detail.js#L3) artık lokal relatif path kullanıyor; [aitopia/marketplace/js/moltopia/share.js](aitopia/marketplace/js/moltopia/share.js) pakette mevcut.
- ✅ **`eval()`:** 0 eşleşme.
- ✅ **`WebAssembly.instantiateStreaming`:** 0 eşleşme.
- ✅ **`chrome.scripting.executeScript`:** Yalnızca [blueBackground.js:210](blueBackground.js#L210) içinde **yorum satırı** olarak var.
- ✅ **`fetch(...).then(r => r.text()).then(eval)` kalıbı:** 0 eşleşme.
- ✅ **Turnstile self-upgrade (`api.js` içinde `createElement("script")`):** [aitopia/marketplace/js/vendor/api.js](aitopia/marketplace/js/vendor/api.js) — Cloudflare Turnstile'ın kendi script'i. Yeni `src`, sayfada zaten yüklü Turnstile `<script>` elementinin `src`'inden türetiliyor (`_upgrade=true`, `_cb=<timestamp>` query param'ları eklenmiş) → dış dünyadan URL gelmiyor. Dosya sadece [login.html:16](aitopia/marketplace/login.html#L16) ve [register.html](aitopia/marketplace/register.html) içinden lokal çağrılıyor.
- ✅ **Vendor dosya isimleri:** `cdn-*--` prefix'i yok. [aitopia/marketplace/js/vendor/](aitopia/marketplace/js/vendor/) altında 15 dosya, hepsi nötr isimlendirme ve lokal.
- ✅ **Docs HTML'leri:** [docs.html](aitopia/marketplace/docs.html) (satır 16-23) ve [docs/triggers-actions.html](aitopia/marketplace/docs/triggers-actions.html) — eski CDN script'leri **tamamen lokal vendor yollarıyla değiştirilmiş** (`/aitopia/marketplace/js/vendor/tailwindcss.min.js`, `/marked.min.js`, `/prism*.min.js`).
- ✅ **`document.write` kullanımı:** Yalnızca [aitopia/assets/8b26285cf7a9af4eff9ca476ff0df406.js](aitopia/assets/8b26285cf7a9af4eff9ca476ff0df406.js) içinde (PDFObject kütüphanesi) — `<iframe>` HTML'i yeni sekmeye yazıyor, dış script yüklemiyor.

---

## Aksiyon Listesi

Düzeltme önceliği (etki × zorluk):

| # | Aksiyon | Dosya(lar) | Zorluk | Risk |
|---|---|---|---|:---:|
| 1 | `aitopia/assets/css/fonts.css` — `@import url('https://fonts.googleapis.com/...')` satırını sil; font dosyalarını `.woff2` olarak paketin içine koy ve lokal `@font-face` ile referansla | [aitopia/assets/css/fonts.css](aitopia/assets/css/fonts.css) | Düşük | 🟡 #3 |
| 2 | Vue render'larında üretilmiş `<link href="fonts.googleapis.com">` injection'larını build kaynağında temizle (Vue bileşenlerinde `<link>` olmamalı) | 6 Vue asset'i | Orta (build config) | 🟡 #3 |
| 3 | `pdf.worker.js`'in pakete eklenmesi ve `GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(...)` ile açıkça set edilmesi; **veya** PDF.js bundle'ının (`68ac5a57...js`) tamamen çıkarılması | [aitopia/assets/68ac5a57...js](aitopia/assets/68ac5a57db35018d532b857bb6626a9c.js) + ek | Orta | 🟡 #2 |
| 4 | `web_accessible_resources.matches` listesini `<all_urls>`'den spesifik origin'lere daralt; `resources` içindeki `*.js` wildcard'ını kaldır (zaten açık liste var) | [manifest.json](manifest.json) | Orta | 🟡 #1 (genel) |
| 5 | `new Function()` içeren vendor'ları (bluebird / heic2any / PDF.js) kullanımları ile birlikte gözden geçir, kullanılmıyorsa çıkar | 5 asset | Orta–Yüksek | 🟡 #1 |

**Kritik not:** Bu pakette **kesin ihlal yok**. Aksiyon listesi cosmetic/preventive temizlik içindir, resubmit için zorunlu değil (fakat reviewer dikkati azaltır).

---

## Rejection'a karşı beklenen durum

Ana paketin (v2.0.4) 22 Nisan reddinin referans audit'e göre **%90 sebebi**, obfuscate edilmiş `createElement("scrIpt")` loader'ıydı. **Bu partner paketinde bu desen hiçbir zaman olmamış.**

Referans audit'in ana pakette bulduğu 3 kesin ihlalin durumu:

| Ana paket ihlali | Bu pakette durum |
|---|---|
| #1 `createElement("scrIpt")` loader | ✅ **YOK** — hiç olmamış |
| #2 Bozuk `.https://aitopia.ai/moltopia/share.js` import | ✅ **DÜZELTİLMİŞ** — lokal path |
| #3 `.disabled` HTML'lerde 10 external `<script src>` | ✅ **KAPATILDI** — `.disabled` dosyası yok, aktif HTML'lerde lokal vendor referansları |

**Tahmin:** Bu paket mevcut haliyle "remote hosted code" gerekçesiyle **büyük olasılıkla reddedilmez**. Kalan riskler:
- `new Function` kullanımı (reviewer manuel dikkati — teknik olarak uyumlu).
- Geniş `web_accessible_resources` (Limited Use / broad permissions kategorisinde işaretlenebilir, remote code değil).
- `fonts.googleapis.com` remote CSS (remote code rejection'a yol açmaz; style-src CSP'de izin gerekir).

**Eğer red gelirse** muhtemelen "broad permissions" veya "Limited Use" politikalarından — "remote hosted code" gerekçesi bu pakete uymuyor.

---

## Remote domain özeti

| Domain | Kullanım | İhlal mi? |
|---|---|:---:|
| `aitopia.ai` | JSON API (`/api/*`, `/store/*`, `/auth/*`) | ❌ (data only) |
| `chatgptextension.ai` | `externally_connectable` hedefi | ⏭️ (kapsam dışı) |
| `fonts.googleapis.com` | `fonts.css` `@import` + 6 Vue asset'inde `<link>` injection | 🟡 CSS (code değil) |
| `cloudflare.com` | Turnstile (`api.js` içinde lokal bundled) | ❌ |
| `cdn.jsdelivr.net` | **Bulunamadı** | ❌ |
| `cdn.tailwindcss.com` | **Bulunamadı** | ❌ |
| `googletagmanager.com` | **Bulunamadı** | ❌ |
| `unpkg.com` | **Bulunamadı** | ❌ |
| `w3.org/2000/svg` | XML namespace | ❌ |

---

## Audit metodolojisi

Kullanılan aramalar (ripgrep, `md/**` dışlanarak):

- `createElement\s*\(\s*["']scr[Ii]pt["']` — büyük/küçük I varyantı dahil script injection → **0 eşleşme** (api.js hariç, o da self-upgrade)
- `import\s+.*from\s+['"][^'"]*https?://` — remote ES module import → **0 eşleşme**
- `\beval\s*\(` → **0 eşleşme**
- `importScripts\s*\(` → 1 dosya (PDF.js createCDNWrapper, detay: #2)
- `WebAssembly\.instantiateStreaming` → **0 eşleşme**
- `chrome\.scripting\.executeScript` → 1 dosya (yorum satırı)
- `cdn\.jsdelivr|googletagmanager|cdn\.tailwindcss|unpkg\.com|fonts\.googleapis\.com` → 7 dosya (6'sı `fonts.googleapis.com`, 1'i fonts.css)
- `<script[^>]+src=\s*["']https?://` (tüm HTML) → **0 eşleşme**
- `\.then\s*\(\s*r\s*=>\s*r\.text\(\)\s*\)\s*\.then\s*\(\s*eval` → **0 eşleşme**
- `innerHTML\s*=\s*[^;]*<script` → **0 eşleşme**
- `Blob\s*\(\s*\[[^\]]*["'][^"']*script` → **0 eşleşme** (PDF.js createCDNWrapper template literal kullandığı için bu regex yakalamaz — manuel inceleme yapıldı)
- `new\s+Function\s*\(` → 5 dosya / ~14 occurrence, hepsi statik template
- `setAttribute\s*\(\s*["']src["']` → 4 dosya, hepsi img/iframe (script değil)
- `Glob **/*.disabled` → **0 dosya**
- `Glob **/pdf.worker*` → **0 dosya** (bulgu #2)

Her eşleşme için dosya + bağlam okunarak false-positive elenmiştir.

---

## Özet: Önceki audit vs bu audit

| Alan | Önceki audit (23 Nisan) | Bu audit (24 Nisan) | Değişim |
|---|---|---|---|
| Kesin ihlal sayısı | 1 (`.html.disabled`) | 0 | ✅ −1 |
| Şüpheli sayısı | 2 (new Function + WAR) | 3 (+ fonts.googleapis.com) | 🟡 +1 |
| `.disabled` dosya sayısı | 2 | **0** | ✅ silinmiş |
| Docs HTML CDN durumu | `.disabled`'da CDN | aktif HTML'de lokal vendor | ✅ düzeltilmiş |
| `pdf.worker.js` mevcut mu | "doğrula" denmişti | **Yok** — eklenmeli | 🟡 tespit |
| `fonts.googleapis.com` | "aktif HTML'lerde bulunamadı" | `fonts.css` + 6 Vue asset | 🟡 fark (muhtemelen önceki audit'te kaçırıldı) |
