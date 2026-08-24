(function () {
  function successUrlRemove() {
    const params = new URLSearchParams(window.location.search);
    const hadLogin = params.has("login");
    const hadRegister = params.has("register");
    if (!hadLogin && !hadRegister) return;
    params.delete("login");
    params.delete("register");
    const remaining = params.toString();
    const newUrl =
      window.location.pathname +
      (remaining ? "?" + remaining : "") +
      window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }

  function GtagInit() {
    if (typeof gtag != "function") return;
    
  }

  function init() {
    GtagInit();
    setTimeout(successUrlRemove, 800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
