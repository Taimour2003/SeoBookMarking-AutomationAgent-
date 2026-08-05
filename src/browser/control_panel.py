from playwright.async_api import Page


async def install_control_panel(
    page: Page,
) -> bool:
    if page.is_closed():
        return False

    try:
        await page.wait_for_selector(
            "body",
            state="attached",
            timeout=10_000,
        )
    except Exception:
        return False

    try:
        return await page.evaluate(
            """
            () => {
                if (!document.body) {
                    return false;
                }

                const existingPanel =
                    document.getElementById(
                        "web-agent-control-panel"
                    );

                if (existingPanel) {
                    return true;
                }

                window.__webAgentAction = null;

                const panel =
                    document.createElement("div");

                panel.id =
                    "web-agent-control-panel";

                Object.assign(
                    panel.style,
                    {
                        position: "fixed",
                        top: "12px",
                        right: "12px",
                        zIndex: "2147483647",
                        background: "#111827",
                        color: "#ffffff",
                        padding: "14px",
                        borderRadius: "10px",
                        boxShadow:
                            "0 8px 24px rgba(0,0,0,.35)",
                        fontFamily:
                            "Arial, sans-serif",
                        width: "250px",
                        boxSizing: "border-box"
                    }
                );

                panel.innerHTML = `
                    <div 
                    id="web-agent-drag-handle"
                    style="
                        font-weight: bold;
                        margin-bottom: 10px;
                        font-size: 16px;
                        cursor:move;
                        user-select:none;
                    ">
                        WebAgent Assistant
                    </div>

                    <div
                        id="web-agent-status"
                        style="
                            font-size: 13px;
                            margin-bottom: 10px;
                            color: #cbd5e1;
                            line-height: 1.4;
                        "
                    >
                        Open a submission form,
                        then click Fill.
                    </div>

                    <button
                        id="web-agent-fill"
                        style="
                            width: 100%;
                            margin-bottom: 8px;
                            padding: 10px;
                            border: none;
                            border-radius: 6px;
                            background: #2563eb;
                            color: white;
                            cursor: pointer;
                            font-weight: bold;
                        "
                    >
                        Fill Current Page
                    </button>

                    <button
                        id="web-agent-submit"
                        style="
                            width: 100%;
                            margin-bottom: 8px;
                            padding: 10px;
                            border: none;
                            border-radius: 6px;
                            background: #16a34a;
                            color: white;
                            cursor: pointer;
                            font-weight: bold;
                        "
                    >
                        Submit Current Page
                    </button>

                    <button
                        id="web-agent-ai-fix"
                        disabled
                        style="
                            width: 100%;
                            margin-bottom: 8px;
                            padding: 10px;
                            border: none;
                            border-radius: 6px;
                            background: #7c3aed;
                            color: white;
                            cursor: not-allowed;
                            font-weight: bold;
                            opacity: .55;
                        "
                    >
                        AI Fix & Resubmit
                    </button>

                    <button
                        id="web-agent-next"
                        style="
                            width: 100%;
                            padding: 10px;
                            border: none;
                            border-radius: 6px;
                            background: #475569;
                            color: white;
                            cursor: pointer;
                            font-weight: bold;
                        "
                    >
                        Refresh Agent
                    </button>
                `;

                document.body.appendChild(panel);
                
                const dragHandle =
                    document.getElementById(
                        "web-agent-drag-handle"
                    );
                
                let isDragging = false;
                let offsetX = 0;
                let offsetY = 0;
                
                dragHandle.addEventListener(
                    "mousedown",
                    event => {
                        isDragging = true;
                
                        const rect =
                            panel.getBoundingClientRect();
                
                        offsetX =
                            event.clientX - rect.left;
                
                        offsetY =
                            event.clientY - rect.top;
                
                        panel.style.right = "auto";
                        panel.style.bottom = "auto";
                
                        document.body.style.userSelect =
                            "none";
                    }
                );
                
                document.addEventListener(
                    "mousemove",
                    event => {
                        if (!isDragging) {
                            return;
                        }
                
                        const panelWidth =
                            panel.offsetWidth;
                
                        const panelHeight =
                            panel.offsetHeight;
                
                        const maxLeft =
                            window.innerWidth
                            - panelWidth;
                
                        const maxTop =
                            window.innerHeight
                            - panelHeight;
                
                        const newLeft = Math.max(
                            0,
                            Math.min(
                                event.clientX - offsetX,
                                maxLeft
                            )
                        );
                
                        const newTop = Math.max(
                            0,
                            Math.min(
                                event.clientY - offsetY,
                                maxTop
                            )
                        );
                
                        panel.style.left =
                            `${newLeft}px`;
                
                        panel.style.top =
                            `${newTop}px`;
                    }
                );
                
                document.addEventListener(
                    "mouseup",
                    () => {
                        if (!isDragging) {
                            return;
                        }
                
                        isDragging = false;
                
                        document.body.style.userSelect =
                            "";
                    }
                );

                const fillButton =
                    document.getElementById(
                        "web-agent-fill"
                    );

                const submitButton =
                    document.getElementById(
                        "web-agent-submit"
                    );

                const aiFixButton =
                    document.getElementById(
                        "web-agent-ai-fix"
                    );

                const refreshButton =
                    document.getElementById(
                        "web-agent-next"
                    );

                fillButton.addEventListener(
                    "click",
                    () => {
                        window.__webAgentAction =
                            "FILL";
                    }
                );

                submitButton.addEventListener(
                    "click",
                    () => {
                        window.__webAgentAction =
                            "SUBMIT";
                    }
                );

                aiFixButton.addEventListener(
                    "click",
                    () => {
                        if (aiFixButton.disabled) {
                            return;
                        }

                        window.__webAgentAction =
                            "AI_FIX";
                    }
                );

                refreshButton.addEventListener(
                    "click",
                    () => {
                        window.__webAgentAction =
                            "REFRESH";
                    }
                );

                return true;
            }
            """
        )

    except Exception as error:
        print(
            "Control panel injection failed:",
            str(error),
        )
        return False


async def wait_for_panel_action(
    page: Page,
) -> str:
    await page.wait_for_function(
        """
        () =>
            typeof window.__webAgentAction
                === "string"
            && window.__webAgentAction.length > 0
    """,
        timeout=0,
    )

    action = await page.evaluate(
        """
        () => {
            const action =
                window.__webAgentAction;

            window.__webAgentAction = null;

            return action;
        }
        """
    )

    if not isinstance(action, str):
        return "NO_ACTION"

    return action


async def update_panel_status(
    page: Page,
    message: str,
) -> None:
    if page.is_closed():
        return

    await page.evaluate(
        """
        message => {
            const status =
                document.getElementById(
                    "web-agent-status"
                );

            if (status) {
                status.textContent = message;
            }
        }
        """,
        arg=message,
    )


async def set_ai_fix_enabled(
    page: Page,
    enabled: bool,
) -> None:
    if page.is_closed():
        return

    await page.evaluate(
        """
        enabled => {
            const button =
                document.getElementById(
                    "web-agent-ai-fix"
                );

            if (!button) {
                return;
            }

            button.disabled = !enabled;

            button.style.opacity = enabled
                ? "1"
                : ".55";

            button.style.cursor = enabled
                ? "pointer"
                : "not-allowed";
        }
        """,
        arg=enabled,
    )
