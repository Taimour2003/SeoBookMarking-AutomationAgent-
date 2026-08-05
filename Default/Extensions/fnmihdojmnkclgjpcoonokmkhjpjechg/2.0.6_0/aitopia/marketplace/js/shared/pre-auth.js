(async () => {
  try {
    const url =
      window.location.hostname.indexOf("localhost") !== -1
        ? `https://extensions.aitopia.ai/extensions/app/key`
        : `https://extensions.aitopia.ai/extensions/app/key`;
    const res = await fetch(
      `https://extensions.aitopia.ai/extensions/app/key`,
      {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      },
    );
    const data = await res.json();
    const key = data?.key;
    if (key) {
      const expires = new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000,
      ).toUTCString();
      document.cookie = `hopekey=${encodeURIComponent(key)}; expires=${expires}; path=/; Secure; SameSite=None; Domain=.aitopia.ai`;
    }
  } catch (e) {
    console.error("pre-auth failed:", e);
  }
})();
