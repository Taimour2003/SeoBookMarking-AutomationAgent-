/**
 * SuperAgent Access Gate
 *
 * Password protection for SuperAgent.
 * Checks localStorage for valid access code, shows gate if not authenticated.
 */

(function () {
  "use strict";

  const STORAGE_KEY = "superagent_access_code";
  const STORAGE_LABEL_KEY = "superagent_access_label";
  const STORAGE_EXPIRES_KEY = "superagent_access_expires";

  function getStoredCode() {
    return localStorage.getItem(STORAGE_KEY);
  }

  function storeAccess(code, label, expiresAt) {
    localStorage.setItem(STORAGE_KEY, code);
    if (label) localStorage.setItem(STORAGE_LABEL_KEY, label);
    if (expiresAt) localStorage.setItem(STORAGE_EXPIRES_KEY, expiresAt);
  }

  function clearAccess() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_LABEL_KEY);
    localStorage.removeItem(STORAGE_EXPIRES_KEY);
  }

  function isExpired() {
    const expires = localStorage.getItem(STORAGE_EXPIRES_KEY);
    if (!expires) return false;
    return new Date(expires) < new Date();
  }

  async function verifyCode(code) {
    try {
      const res = await fetch("https://aitopia.ai/api/superagent/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return { valid: true, label: json.label, expiresAt: json.expiresAt };
      }
      return { valid: false, error: json.error || "Invalid access code" };
    } catch (e) {
      return { valid: false, error: "Connection error. Please try again." };
    }
  }

  function createGateOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "superagent-gate";
    overlay.innerHTML = `
      <style>
        #superagent-gate {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: hsl(var(--aifnmjmchg-m-background));
        }
        #superagent-gate .gate-card {
          width: 100%;
          max-width: 400px;
          margin: 1rem;
          padding: 2rem;
          border-radius: 1.5rem;
          background: hsl(var(--aifnmjmchg-m-card));
          border: 1px solid hsl(var(--aifnmjmchg-m-border));
          text-align: center;
        }
        #superagent-gate .gate-logo {
          width: 64px;
          height: 64px;
          margin: 0 auto 1.5rem;
          background: linear-gradient(135deg, hsl(var(--aifnmjmchg-m-primary)), hsl(280, 80%, 60%));
          border-radius: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
        }
        #superagent-gate h1 {
          font-size: 1.5rem;
          font-weight: 700;
          color: hsl(var(--aifnmjmchg-m-foreground));
          margin-bottom: 0.5rem;
        }
        #superagent-gate p {
          color: hsl(var(--aifnmjmchg-m-muted-foreground));
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }
        #superagent-gate input {
          width: 100%;
          padding: 0.875rem 1rem;
          font-size: 1rem;
          border-radius: 0.75rem;
          border: 1px solid hsl(var(--aifnmjmchg-m-border));
          background: hsl(var(--aifnmjmchg-m-background));
          color: hsl(var(--aifnmjmchg-m-foreground));
          outline: none;
          transition: border-color 0.15s;
        }
        #superagent-gate input:focus {
          border-color: hsl(var(--aifnmjmchg-m-primary));
        }
        #superagent-gate button {
          width: 100%;
          margin-top: 1rem;
          padding: 0.875rem;
          font-size: 1rem;
          font-weight: 600;
          border-radius: 0.75rem;
          border: none;
          background: hsl(var(--aifnmjmchg-m-primary));
          color: hsl(var(--aifnmjmchg-m-primary-foreground));
          cursor: pointer;
          transition: opacity 0.15s;
        }
        #superagent-gate button:hover {
          opacity: 0.9;
        }
        #superagent-gate button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        #superagent-gate .gate-error {
          margin-top: 1rem;
          padding: 0.75rem;
          border-radius: 0.5rem;
          background: hsl(0, 70%, 50%, 0.1);
          color: hsl(0, 70%, 60%);
          font-size: 0.875rem;
        }
        #superagent-gate .gate-error.hidden {
          display: none;
        }
        #superagent-gate .gate-back {
          margin-top: 1.5rem;
        }
        #superagent-gate .gate-back a {
          color: hsl(var(--aifnmjmchg-m-muted-foreground));
          font-size: 0.875rem;
          text-decoration: none;
        }
        #superagent-gate .gate-back a:hover {
          color: hsl(var(--aifnmjmchg-m-foreground));
        }
      </style>
      <div class="gate-card">
        <div class="gate-logo">🔐</div>
        <h1>Access Required</h1>
        <p>Enter your access code to continue to SuperAgent.</p>
        <form id="gate-form">
          <input type="password" id="gate-code" placeholder="Enter access code" autocomplete="off" required>
          <button type="submit" id="gate-submit">Continue</button>
        </form>
        <div id="gate-error" class="gate-error hidden"></div>
        <div class="gate-back">
          <a href="/aitopia/marketplace/owner.html?owner=store">← Back to Store</a>
        </div>
      </div>
    `;
    return overlay;
  }

  function showGate() {
    // Hide the main app content
    const app = document.querySelector(".app");
    document.querySelectorAll("body > *").forEach((item) => {
      item.style.display = "none";
    });
    if (app) app.style.display = "none";

    // Create and show gate
    const gate = createGateOverlay();
    document.body.appendChild(gate);

    const form = document.getElementById("gate-form");
    const input = document.getElementById("gate-code");
    const submit = document.getElementById("gate-submit");
    const errorEl = document.getElementById("gate-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = input.value.trim();
      if (!code) return;

      submit.disabled = true;
      submit.textContent = "Verifying…";
      errorEl.classList.add("hidden");

      const result = await verifyCode(code);

      if (result.valid) {
        storeAccess(code, result.label, result.expiresAt);
        gate.remove();
        if (app) app.style.display = "";
        document.querySelectorAll("body > *").forEach((item) => {
          item.style.display = "";
        });
      } else {
        errorEl.textContent = result.error;
        errorEl.classList.remove("hidden");
        submit.disabled = false;
        submit.textContent = "Continue";
        input.focus();
        input.select();
      }
    });

    input.focus();
  }

  async function checkAccess() {
    const storedCode = getStoredCode();

    // No stored code - show gate
    if (!storedCode) {
      showGate();
      return;
    }

    // Check if expired locally
    if (isExpired()) {
      clearAccess();
      showGate();
      return;
    }

    // Verify with server (re-validates and logs access)
    const result = await verifyCode(storedCode);
    if (!result.valid) {
      clearAccess();
      showGate();
      return;
    }

    // Update expiration if changed
    if (result.expiresAt) {
      localStorage.setItem(STORAGE_EXPIRES_KEY, result.expiresAt);
    }

    // Access granted - app is already visible
  }

  // Run check when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAccess);
  } else {
    checkAccess();
  }
})();
