from __future__ import annotations

from playwright.async_api import Page


SUPPORTED_SCHEMES = ("http://", "https://")


def is_supported_page(page: Page) -> bool:
    return not page.is_closed() and page.url.startswith(SUPPORTED_SCHEMES)


async def install_control_panel(page: Page) -> bool:
    """
    Installs a small collapsed launcher on a normal HTTP(S) page.

    The full assistant is created inside Shadow DOM, minimizing CSS conflicts
    with the host website. Collapsing the panel leaves only the launcher and
    sets the assistant to an inactive state.
    """
    if not is_supported_page(page):
        return False

    try:
        await page.wait_for_selector("body", state="attached", timeout=10_000)
    except Exception:
        return False

    try:
        return await page.evaluate(
            r"""
            () => {
                if (!document.body) return false;

                const existingHost = document.getElementById("web-agent-host");
                if (existingHost) return true;

                window.__webAgentAction = null;
                window.__webAgentEnabled = false;

                const host = document.createElement("div");
                host.id = "web-agent-host";
                host.style.position = "fixed";
                host.style.inset = "0";
                host.style.pointerEvents = "none";
                host.style.zIndex = "2147483647";

                const shadow = host.attachShadow({ mode: "open" });

                const style = document.createElement("style");
                style.textContent = `
                    * { box-sizing: border-box; }
                    #launcher {
                        position: fixed;
                        right: 18px;
                        bottom: 18px;
                        width: 52px;
                        height: 52px;
                        border-radius: 50%;
                        border: 0;
                        background: #2563eb;
                        color: #fff;
                        font: 700 15px Arial, sans-serif;
                        box-shadow: 0 8px 24px rgba(0,0,0,.28);
                        cursor: pointer;
                        pointer-events: auto;
                    }
                    #launcher[data-state="blocked"] { background: #d97706; }
                    #launcher[data-state="error"] { background: #dc2626; }
                    #launcher[data-state="ai"] { background: #7c3aed; }
                    #launcher[data-state="success"] { background: #16a34a; }
                    #panel {
                        position: fixed;
                        top: 16px;
                        right: 16px;
                        width: 290px;
                        padding: 14px;
                        border-radius: 12px;
                        background: #111827;
                        color: #fff;
                        font-family: Arial, sans-serif;
                        box-shadow: 0 10px 32px rgba(0,0,0,.38);
                        pointer-events: auto;
                        display: none;
                    }
                    #panel.open { display: block; }
                    #header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 12px;
                        margin-bottom: 10px;
                        cursor: move;
                        user-select: none;
                    }
                    #title { font-weight: 700; font-size: 16px; }
                    #collapse {
                        border: 0;
                        background: transparent;
                        color: #cbd5e1;
                        font-size: 20px;
                        cursor: pointer;
                    }
                    #status {
                        color: #cbd5e1;
                        font-size: 13px;
                        line-height: 1.45;
                        margin-bottom: 12px;
                        word-break: break-word;
                    }
                    .action {
                        width: 100%;
                        border: 0;
                        border-radius: 7px;
                        padding: 10px;
                        margin-bottom: 8px;
                        color: white;
                        font-weight: 700;
                        cursor: pointer;
                    }
                    #fill { background: #2563eb; }
                    #submit { background: #16a34a; }
                    #ai { background: #7c3aed; }
                    #refresh { background: #475569; margin-bottom: 0; }
                    .action:disabled {
                        cursor: not-allowed;
                        opacity: .5;
                    }
                `;

                const launcher = document.createElement("button");
                launcher.id = "launcher";
                launcher.textContent = "WA";
                launcher.title = "Open WebAgent Assistant";
                launcher.dataset.state = "ready";

                const panel = document.createElement("section");
                panel.id = "panel";
                panel.innerHTML = `
                    <div id="header">
                        <div id="title">WebAgent Assistant</div>
                        <button id="collapse" title="Collapse">−</button>
                    </div>
                    <div id="status">Ready. Open a submission form and click Fill.</div>
                    <button class="action" id="fill">Fill Current Page</button>
                    <button class="action" id="submit">Submit Current Page</button>
                    <button class="action" id="ai" disabled>AI Fix & Resubmit</button>
                    <button class="action" id="refresh">Refresh Agent</button>
                `;

                shadow.append(style, launcher, panel);
                document.body.appendChild(host);

                const fillButton = shadow.getElementById("fill");
                const submitButton = shadow.getElementById("submit");
                const aiButton = shadow.getElementById("ai");
                const refreshButton = shadow.getElementById("refresh");
                const collapseButton = shadow.getElementById("collapse");
                const header = shadow.getElementById("header");

                const openPanel = () => {
                    panel.classList.add("open");
                    launcher.style.display = "none";
                    window.__webAgentEnabled = true;
                };

                const collapsePanel = () => {
                    panel.classList.remove("open");
                    launcher.style.display = "block";
                    window.__webAgentEnabled = false;
                    window.__webAgentAction = null;
                };

                launcher.addEventListener("click", openPanel);
                collapseButton.addEventListener("click", collapsePanel);

                fillButton.addEventListener("click", () => {
                    window.__webAgentAction = "FILL";
                });
                submitButton.addEventListener("click", () => {
                    window.__webAgentAction = "SUBMIT";
                });
                aiButton.addEventListener("click", () => {
                    if (!aiButton.disabled) window.__webAgentAction = "AI_FIX";
                });
                refreshButton.addEventListener("click", () => {
                    window.__webAgentAction = "REFRESH";
                });

                // Draggable full panel.
                let dragging = false;
                let offsetX = 0;
                let offsetY = 0;

                header.addEventListener("mousedown", event => {
                    if (event.target === collapseButton) return;
                    dragging = true;
                    const rect = panel.getBoundingClientRect();
                    offsetX = event.clientX - rect.left;
                    offsetY = event.clientY - rect.top;
                    panel.style.right = "auto";
                    document.documentElement.style.userSelect = "none";
                });

                document.addEventListener("mousemove", event => {
                    if (!dragging) return;
                    const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
                    const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
                    const left = Math.max(0, Math.min(event.clientX - offsetX, maxLeft));
                    const top = Math.max(0, Math.min(event.clientY - offsetY, maxTop));
                    panel.style.left = `${left}px`;
                    panel.style.top = `${top}px`;
                });

                document.addEventListener("mouseup", () => {
                    dragging = false;
                    document.documentElement.style.userSelect = "";
                });

                // Default state is collapsed/inactive.
                collapsePanel();
                return true;
            }
            """
        )
    except Exception:
        return False


async def consume_panel_action(page: Page) -> str | None:
    """Non-blocking action read. Returns None when no button was clicked."""
    if not is_supported_page(page):
        return None

    try:
        return await page.evaluate(
            r"""
            () => {
                if (window.__webAgentEnabled !== true) return null;
                const action = window.__webAgentAction;
                window.__webAgentAction = null;
                return typeof action === "string" ? action : null;
            }
            """
        )
    except Exception:
        return None


async def update_panel_status(page: Page, message: str) -> None:
    if not is_supported_page(page):
        return
    try:
        await page.evaluate(
            r"""
            message => {
                const host = document.getElementById("web-agent-host");
                const status = host?.shadowRoot?.getElementById("status");
                if (status) status.textContent = message;
            }
            """,
            arg=message,
        )
    except Exception:
        return


async def set_ai_fix_enabled(page: Page, enabled: bool) -> None:
    if not is_supported_page(page):
        return
    try:
        await page.evaluate(
            r"""
            enabled => {
                const host = document.getElementById("web-agent-host");
                const button = host?.shadowRoot?.getElementById("ai");
                if (button) button.disabled = !enabled;
            }
            """,
            arg=enabled,
        )
    except Exception:
        return


async def set_panel_state(page: Page, state: str) -> None:
    """State controls only the launcher's color: ready/blocked/error/ai/success."""
    if not is_supported_page(page):
        return
    try:
        await page.evaluate(
            r"""
            state => {
                const host = document.getElementById("web-agent-host");
                const launcher = host?.shadowRoot?.getElementById("launcher");
                if (launcher) launcher.dataset.state = state;
            }
            """,
            arg=state,
        )
    except Exception:
        return