// Inline (data URL) limits: keep payloads small (base64 inflates; server JSON limit is 50mb).
export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_AUDIO_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_FILE_BYTES = 15 * 1024 * 1024; // 15MB

// Upload limits: files larger than the inline limits are uploaded to `https://aitopia.ai/api/uploads`
// and referenced by URL in the subsequent `https://aitopia.ai/api/store/:id/run` request.
export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_AUDIO_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_VIDEO_UPLOAD_BYTES = 150 * 1024 * 1024; // 150MB

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return `${bytes}`;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]
    }`;
}

export async function uploadUrlToServer(url) {
  const hopeKey = getCookie("hopekey");
  const headers = { "Content-Type": "application/json" };
  if (hopeKey) {
    headers["hopekey"] = hopeKey;
  }

  const res = await fetch("https://aitopia.ai/api/uploads", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ url }), // Send URL in JSON body
  });

  const json = await readJsonSafely(res);
  if (!res.ok) {
    const message = json?.error || json?.message || "Failed to upload URL";
    throw new Error(message);
  }

  return json.url;
}

// Helper to safely check if we are in a browser environment
function isBrowser() {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

export async function fileToDataUrl(file) {
  // If not in browser (e.g. build time), just return the input or null to avoid crashing
  if (!isBrowser()) {
    return file;
  }

  // 1. If it's a File object (only in browser), upload it normally
  if (typeof File !== 'undefined' && file instanceof File) {
    return await uploadFileToServer(file, { filename: file.name || 'upload.bin' });
  }

  // Also handle generic object if it looks like a file but instanceof check fails (rare but possible across frames)
  if (typeof file === "object" && file !== null && (file.name || file.type)) {
    if (typeof File !== 'undefined') {
      // Try to ensure it is treated as a File/Blob
      return await uploadFileToServer(file, { filename: file.name });
    }
  }

  // 2. If it's a string, handle Base64 or URL
  if (typeof file === "string") {
    // Case A: Base64 string (data:image/...)
    if (file.startsWith("data:")) {
      try {
        const fetch = window.fetch; // Use window.fetch explicitly
        const res = await fetch(file);
        const blob = await res.blob();

        const mime = blob.type || "application/octet-stream";
        let ext = "bin";
        if (mime.includes("image/png")) ext = "png";
        else if (mime.includes("image/jpeg")) ext = "jpg";
        else if (mime.includes("image/webp")) ext = "webp";
        else if (mime.includes("/")) ext = mime.split("/")[1];

        const filename = `paste-${Date.now()}.${ext}`;
        const fileObj = new File([blob], filename, { type: mime });

        return await uploadFileToServer(fileObj, { filename });
      } catch (err) {
        console.error("Failed to convert base64 to file:", err);
        throw new Error("Failed to process pasted image data");
      }
    }

    // Case B: Public URL (http...)
    if (file.startsWith("http")) {
      return await uploadUrlToServer(file);
    }
  }

  // Fallback: Try reading as Blob using FileReader
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      return reject(new Error('FileReader not available'));
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    try {
      reader.readAsDataURL(file);
    } catch (e) {
      reject(new Error("Invalid input: not a File or recognized string format"));
    }
  });
}

export async function fileToBase64(file) {
  const result = await fileToDataUrl(file);
  if (typeof result !== "string") throw new Error("Failed to read file");

  // 1. Eğer sonuç zaten bir URL ise (CDN linki), doğrudan döndür
  if (result.startsWith("http")) {
    return result;
  }

  // 2. Eğer sonuç bir base64 (data:...) ise, bunu mutlaka CDN'e yükle
  // Takım liderinin isteği: "base64 gelse bile cdn'e kayıt edip onun url'ini göndermesi lazım"
  if (result.startsWith("data:")) {
    try {
      const cdnUrl = await uploadUrlToServer(result);
      if (cdnUrl && cdnUrl.startsWith("http")) {
        return cdnUrl;
      }
    } catch (err) {
      console.error("fileToBase64: CDN upload failed:", err);
      // Hata alsa bile base64'ü döndürmüyoruz, çünkü modeller artık bunu kabul etmiyor.
      throw new Error("Görsel CDN'e yüklenemedi. Lütfen tekrar deneyin.");
    }
  }

  // Eğer hiçbir link üretilemediyse hata fırlat
  throw new Error("Görsel işlenemedi (Geçersiz format)");
}

async function readJsonSafely(res) {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

export async function uploadFileToServer(file, options = {}) {
  if (!(file instanceof File)) throw new Error("Invalid file");

  const filename =
    typeof options.filename === "string" && options.filename.trim().length > 0
      ? options.filename.trim()
      : file.name;

  const params = new URLSearchParams();
  if (filename) params.set("filename", filename);

  const url = `https://aitopia.ai/api/uploads${params.toString() ? `?${params.toString()}` : ""}`;
  const headers = { "Content-Type": file.type || "application/octet-stream" };

  // Pass hopekey for CDN attribution
  const hopeKey = getCookie("hopekey");
  if (hopeKey) {
    headers["hopekey"] = hopeKey;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: file,
  });

  const json = await readJsonSafely(res);
  if (!res.ok) {
    const message =
      json?.error || json?.message || `Upload failed (${res.status})`;
    throw new Error(message);
  }

  const uploadedUrl = json?.url;
  if (!uploadedUrl || typeof uploadedUrl !== "string") {
    throw new Error("Upload failed: missing URL in response");
  }
  return uploadedUrl;
}

function normalizeMediaKindHint(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === "image") return "image";
  if (v === "video") return "video";
  if (v === "audio") return "audio";
  if (v === "imageorvideo" || v === "image_or_video" || v === "image-video")
    return "imageOrVideo";
  if (v === "audioorvideo" || v === "audio_or_video" || v === "audio-video")
    return "audioOrVideo";
  return null;
}

export function guessMediaKind(fieldKey, propSchema) {
  // UAP/UI can provide explicit hints (x-uap.mediaKind). Respect those first.
  const direct = propSchema && typeof propSchema === "object" ? propSchema : {};
  const xuap =
    direct["x-uap"] && typeof direct["x-uap"] === "object"
      ? direct["x-uap"]
      : null;
  const hinted = normalizeMediaKindHint(
    xuap?.mediaKind ?? direct["x-uap.mediaKind"]
  );
  if (hinted) return hinted;

  const key = String(fieldKey || "").toLowerCase();
  if (!key) return null;
  const description = String(propSchema?.description || "").toLowerCase();
  const type = String(propSchema?.type || "").toLowerCase();
  const format = String(propSchema?.format || "").toLowerCase();

  // IMPORTANT: Only consider string-type fields as potential media fields.
  // Numeric fields like "duration" should never be treated as media uploads,
  // even if their description mentions "video" or "audio".
  if (type !== "string" && type !== "") {
    return null;
  }

  if (format === "textarea") {
    return null;
  }

  if (Array.isArray(propSchema?.enum) && propSchema.enum.length > 0) {
    return null;
  }

  const hint = `${key} ${description}`;

  if (type === "string" && format === "binary") {
    // We'll try to infer accept type from the field name.
    if (hint.includes("video")) return "video";
    if (hint.includes("audio") || hint.includes("voice")) return "audio";
    return "image";
  }

  const keyHasImage =
    key.includes("image") ||
    key.includes("img") ||
    key.includes("photo") ||
    key.includes("picture") ||
    key.includes("thumbnail") ||
    key.includes("thumb");
  const keyHasVideo = key.includes("video");
  const keyHasAudio = key.includes("audio") || key.includes("voice");

  const descHasImage =
    description.includes("image") ||
    description.includes("photo") ||
    description.includes("picture") ||
    description.includes("thumbnail");
  const descHasVideo = description.includes("video");
  const descHasAudio =
    description.includes("audio") || description.includes("voice");

  const hasImage = keyHasImage || descHasImage;
  const hasVideo = keyHasVideo || descHasVideo;
  const hasAudio = keyHasAudio || descHasAudio;

  // If a field explicitly accepts multiple media types, prefer a dual-kind widget.
  if (hasAudio && hasVideo) return "audioOrVideo";
  if (hasImage && hasVideo) return "imageOrVideo";

  if (hasVideo) return "video";
  if (hasAudio) return "audio";
  if (hasImage) return "image";

  return null;
}

export function acceptForKind(kind) {
  if (kind === "imageOrVideo") return "image/*,video/*";
  if (kind === "audioOrVideo") return "audio/*,video/*";
  if (kind === "video") return "video/*";
  if (kind === "audio") return "audio/*";
  return "image/*";
}

export function maxBytesForKind(kind) {
  if (kind === "video" || kind === "audioOrVideo" || kind === "imageOrVideo") return MAX_VIDEO_UPLOAD_BYTES;
  if (kind === "audio") return MAX_AUDIO_UPLOAD_BYTES;
  return MAX_IMAGE_UPLOAD_BYTES;
}

export function maxInlineBytesForKind(kind) {
  if (kind === "video" || kind === "audioOrVideo" || kind === "imageOrVideo") return MAX_VIDEO_FILE_BYTES;
  if (kind === "audio") return MAX_AUDIO_FILE_BYTES;
  return MAX_IMAGE_FILE_BYTES;
}
