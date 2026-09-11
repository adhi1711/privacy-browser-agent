// ========================================
// PRIVACY BROWSER AGENT - POPUP
// ========================================
// Dashboard UI. Talks to the content script
// via chrome.runtime messages and renders the
// real pipeline state. No fabricated numbers.

"use strict";

const $ = (id) => document.getElementById(id);

const STAGE_IDS = [
    "webpage",
    "ai",
    "detect",
    "redact",
    "sanitize",
    "cloud",
    "action"
];

const ENTITY_LABELS = {
    PERSON: "Personal name",
    EMAIL: "Email address",
    PHONE: "Phone number",
    LOCATION: "Location",
    ORGANIZATION: "Organization"
};

const MASKED_TOKENS = [
    "[PERSON]",
    "[EMAIL]",
    "[PHONE]",
    "[LOCATION]",
    "[ORGANIZATION]"
];

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------

function freshStages() {

    const stages = {};

    for (const name of STAGE_IDS) {
        stages[name] = { state: "waiting", detail: "" };
    }

    return stages;
}

let state = {
    busy: false,
    aiReady: false,
    page: { url: "", title: "" },
    logs: [],
    nodeCount: 0,
    redactedCount: 0,
    stages: freshStages(),
    entities: [],
    samples: [],
    cloudExposure: null,
    sanitizedPreview: "",
    action: null,
    actionStatus: "",
    timing: {},
    error: null
};

function normalize(raw) {

    const current = { ...state };

    const next = {
        busy: Boolean(raw?.busy) || current.busy,
        aiReady: Boolean(raw?.aiReady),
        page: raw?.page ? { ...raw.page } : current.page,
        logs: Array.isArray(raw?.logs) ? raw.logs : current.logs,
        nodeCount:
            raw?.nodeCount !== undefined && raw.nodeCount !== null
                ? Number(raw.nodeCount)
                : current.nodeCount,
        redactedCount:
            raw?.redactedCount !== undefined && raw.redactedCount !== null
                ? Number(raw.redactedCount)
                : current.redactedCount,
        stages: { ...freshStages(), ...(raw?.stages || {}) },
        entities: Array.isArray(raw?.entities)
            ? raw.entities
            : current.entities,
        samples: Array.isArray(raw?.samples)
            ? raw.samples
            : current.samples,
        cloudExposure:
            raw?.cloudExposure !== undefined &&
            raw.cloudExposure !== null
                ? raw.cloudExposure
                : current.cloudExposure,
        sanitizedPreview:
            typeof raw?.sanitizedPreview === "string"
                ? raw.sanitizedPreview
                : current.sanitizedPreview,
        action: raw?.action !== undefined ? raw.action : current.action,
        actionStatus:
            typeof raw?.actionStatus === "string"
                ? raw.actionStatus
                : current.actionStatus,
        timing: { ...current.timing, ...(raw?.timing || {}) },
        error: typeof raw?.error === "string" ? raw.error : current.error
    };

    return next;
}


// ------------------------------------------------------------
// MESSAGING
// ------------------------------------------------------------

function sendToTab(tabId, message) {

    return new Promise((resolve) => {

        try {

            chrome.tabs.sendMessage(
                tabId,
                message,
                (response) => {

                    if (chrome.runtime.lastError) {
                        resolve(null);
                        return;
                    }

                    resolve(response);
                }
            );

        } catch (error) {
            resolve(null);
        }
    });
}

async function activeTab() {

    const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    return tabs && tabs[0] ? tabs[0] : null;
}

chrome.runtime.onMessage.addListener((message) => {

    if (!message || message.type !== "PBA_STATE") {
        return;
    }

    state = normalize(message.state);

    render();
});


// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------

async function prime() {

    const tab = await activeTab();

    if (!tab || !tab.id) {

        setNotice("No active tab.");
        return;
    }

    const url = tab.url || "";

    if (!/^(https?|file):/.test(url)) {

        setNotice(
            "Open the demo page (http://localhost:3000/test.html) to begin."
        );

        return;
    }

    const pong = await sendToTab(tab.id, { type: "PBA_PING" });

    if (!pong || !pong.ok) {

        setNotice(
            "Agent not detected on this page. Open http://localhost:3000/test.html and reload the tab."
        );

        render();

        return;
    }

    clearNotice();

    const response =
        await sendToTab(tab.id, { type: "PBA_GET_STATE" });

    if (response && response.state) {

        state = normalize(response.state);
    }

    if ((!state.page || !state.page.url) && tab.url) {
        state = {
            ...state,
            page: {
                url: tab.url || "",
                title: tab.title || ""
            }
        };
    }

    render();
}

function bindEvents() {

    $("analyzeBtn").addEventListener("click", analyze);
    $("captureBtn").addEventListener("click", capture);

    document
        .querySelectorAll(".tab")
        .forEach((button) => {
            button.addEventListener("click", switchTab);
        });

    $("clearLogsBtn").addEventListener("click", clearLogs);
    $("logFilter").addEventListener("change", renderLogs);
    $("logSearch").addEventListener("input", renderLogs);
}

function switchTab(event) {

    const name = event.currentTarget.dataset.tab;

    document
        .querySelectorAll(".tab")
        .forEach((button) => {
            button.classList.toggle(
                "active",
                button.dataset.tab === name
            );
        });

    document
        .querySelectorAll(".view")
        .forEach((view) => {
            view.classList.toggle(
                "hidden",
                view.id !== "view-" + name
            );
        });
}

async function clearLogs() {

    state = { ...state, logs: [] };

    renderLogs();

    const tab = await activeTab();

    if (tab && tab.id) {
        await sendToTab(tab.id, { type: "PBA_CLEAR_LOGS" });
    }
}


// ------------------------------------------------------------
// ANALYZE
// ------------------------------------------------------------

async function analyze() {

    clearNotice();

    const tab = await activeTab();

    if (!tab || !tab.id) {

        setNotice("No active tab.", true);
        return;
    }

    const pong = await sendToTab(tab.id, { type: "PBA_PING" });

    if (!pong || !pong.ok) {

        setNotice(
            "Agent not detected on this page. Open http://localhost:3000/test.html and reload the tab.",
            true
        );

        return;
    }

    // Optimistic UI feedback while the pipeline starts.
    const running = freshStages();

    running.webpage = { state: "processing", detail: "" };

    state = {
        ...state,
        busy: true,
        stages: running,
        entities: [],
        samples: [],
        cloudExposure: null,
        sanitizedPreview: "",
        action: null,
        actionStatus: "",
        error: null
    };

    render();

    const response =
        await sendToTab(tab.id, { type: "PBA_ANALYZE" });

    if (!response) {

        setNotice("Analysis request could not reach the agent.", true);
        return;
    }

    if (response.ok === false && response.reason === "busy") {

        // Restore whatever the content script actually has.
        const restored =
            await sendToTab(tab.id, { type: "PBA_GET_STATE" });

        if (restored && restored.state) {

            state = normalize(restored.state);
        }

        render();

        setNotice("Analysis already in progress.");
    }
}


// ------------------------------------------------------------
// CAPTURE SCREENSHOT (EXPERIMENTAL VISION)
// ------------------------------------------------------------

async function capture() {

    const btn = $("captureBtn");

    setVStatus("Capturing screenshot…");

    const tab = await activeTab();

    if (!tab || !tab.id) {

        setVStatus("No active tab.", true);
        return;
    }

    btn.disabled = true;

    try {

        const screenshot =
            await chrome.tabs.captureVisibleTab(
                tab.windowId,
                { format: "png" }
            );

        setVStatus("Captured. Loading local vision model…");

        const response = await fetch(screenshot);

        const blob = await response.blob();

        const imageBitmap =
            await createImageBitmap(blob);

        setVStatus("Analyzing screenshot with YOLOS…");

        const canvas = document.createElement("canvas");

        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;

        canvas.getContext("2d").drawImage(imageBitmap, 0, 0);

        const visionModule =
            await import(
                chrome.runtime.getURL("dist/vision.mjs")
            );

        const results =
            await visionModule.analyzeScreenshot(canvas);

        const boxes = Array.isArray(results) ? results : [];

        setVStatus(
            `Screenshot ${imageBitmap.width}×${imageBitmap.height} analyzed locally. ` +
            `YOLOS returned ${boxes.length} detection box${boxes.length === 1 ? "" : "es"} ` +
            "(experimental — not used for action decisions).",
            false
        );

        if (boxes.length > 0) {

            const labels =
                Array.from(
                    new Set(
                        boxes.map(b => b.label || "?").filter(Boolean)
                    )
                ).join(", ");

            $("visionNote").textContent =
                "Detected (experimental): " + labels;
        }

    } catch (error) {

        console.error("VISION ERROR:", error);

        setVStatus(
            "Vision module unavailable. Screenshot capture still works.",
            true
        );

    } finally {

        btn.disabled = false;
    }
}


// ------------------------------------------------------------
// NOTICES
// ------------------------------------------------------------

let noticeTimer = null;

function setNotice(text, error) {

    const el = $("notice");

    if (!text) {

        el.textContent = "";
        el.className = "notice";
        return;
    }

    el.textContent = text;

    el.className = error ? "notice notice-error" : "notice notice-ok";

    if (noticeTimer) {
        clearTimeout(noticeTimer);
    }

    noticeTimer = setTimeout(() => {
        el.textContent = "";
        el.className = "notice";
    }, 7000);
}

function clearNotice() {

    setNotice("");
}

function setVStatus(text, error) {

    const el = $("visionStatus");

    el.className = "vision-status";

    el.classList.add(error ? "warn" : "ok");

    el.textContent = text;
}


// ------------------------------------------------------------
// UTILITIES
// ------------------------------------------------------------

function fmt(ms) {

    if (ms === undefined || ms === null) {
        return "—";
    }

    if (ms < 1000) {
        return ms + " ms";
    }

    return (ms / 1000).toFixed(2) + " s";
}

function escapeHtml(text) {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function highlightMasks(preview) {

    let html = escapeHtml(preview);

    for (const token of MASKED_TOKENS) {

        html = html.split(
            token
        ).join(
            `<span class="masked-token">${token}</span>`
        );
    }

    return html;
}

function totalDetected() {

    return (state.entities || []).reduce(
        (sum, e) => sum + (Number(e.count) || 0),
        0
    );
}

function countProtected() {

    let total = 0;

    for (const token of MASKED_TOKENS) {

        const count =
            (state.sanitizedPreview || "")
                .split(token).length - 1;

        total += Math.max(0, count);
    }

    return total;
}

function hasStageError() {

    return STAGE_IDS.some(
        name => state.stages?.[name]?.state === "error"
    );
}


// ------------------------------------------------------------
// RENDER
// ------------------------------------------------------------

function render() {

    renderBadge();
    renderPipeline();
    renderLocalAnalysis();
    renderEntities();
    renderBeforeAfter();
    renderCloudPreview();
    renderCloudReasoning();
    renderAction();
    renderReport();
    renderMetrics();
    renderPerception();
    renderPipelineGraph();
    renderLogs();
}

function renderBadge() {

    const badge = $("protectionBadge");

    if (state.busy || hasStageError()) {

        badge.className = "badge badge-warn";
        $("protectionText").textContent =
            hasStageError() ? "PROTECTION DEGRADED" : "ANALYSIS RUNNING";

    } else {

        badge.className = "badge badge-ok";
        $("protectionText").textContent = "PROTECTION ACTIVE";
    }
}

function renderPipeline() {

    const header = $("pipelineState");

    if (state.busy) {

        header.textContent = "Processing…";

    } else if (hasStageError()) {

        header.textContent = "Error";

    } else if (
        state.stages.action?.state === "complete" ||
        state.stages.cloud?.state === "complete"
    ) {

        header.textContent = "Complete";

    } else {

        header.textContent = "Idle";
    }

    for (const name of STAGE_IDS) {

        const el = $(`stage-${name}`);

        if (!el) continue;

        const stage = state.stages[name] || { state: "waiting", detail: "" };

        el.dataset.state = stage.state;

        el.querySelector(".detail").textContent =
            stage.detail || "";
    }
}

function renderLocalAnalysis() {

    const pageDone = state.stages.webpage?.state === "complete";
    const aiDone = state.aiReady;
    const scanDone = state.stages.detect?.state === "complete";

    setLocalItem("localPageItem", pageDone);
    setLocalItem("localAiItem", aiDone);
    setLocalItem("localScanItem", scanDone);

    $("localAiTag").textContent =
        aiDone ? "Local AI ready" : "Local AI loading…";
}

function setLocalItem(id, ok) {

    const el = $(id);

    el.dataset.ok = String(ok);

    el.dataset.pending = "";

    el.querySelector(".mark").textContent = ok ? "✓" : "○";
}

function renderEntities() {

    const list = $("entityList");

    list.innerHTML = "";

    const entities = state.entities || [];

    if (entities.length === 0) {

        const empty = document.createElement("div");

        empty.className = "count-row";

        const scanDone =
            state.stages.detect?.state === "complete" ||
            state.stages.sanitize?.state === "complete" ||
            state.stages.cloud?.state === "complete";

        empty.innerHTML =
            `<span class="type" style="color:var(--faint)">` +
            (scanDone ? "NO SENSITIVE DATA" : "AWAITING ANALYSIS") +
            `</span>` +
            `<span class="num" style="color:var(--faint)">—</span>`;

        list.appendChild(empty);

    } else {

        for (const entity of entities) {

            const row = document.createElement("div");

            row.className = "count-row";

            const type = document.createElement("span");

            type.className = "type";

            type.textContent = entity.label || "—";

            const num = document.createElement("span");

            num.className = "num";

            num.textContent = String(entity.count || 0);

            row.appendChild(type);
            row.appendChild(num);

            list.appendChild(row);
        }
    }

    const exposure = $("cloudExposureValue");

    exposure.textContent =
        state.cloudExposure === null || state.cloudExposure === undefined
            ? "—"
            : String(state.cloudExposure);
}

function renderBeforeAfter() {

    const beforeList = $("beforeList");
    const afterList = $("afterList");

    beforeList.innerHTML = "";
    afterList.innerHTML = "";

    const samples = state.samples || [];

    if (samples.length === 0) {

        beforeList.innerHTML =
            '<span class="ba-empty">Awaiting analysis…</span>';

        afterList.innerHTML =
            '<span class="ba-empty">Awaiting analysis…</span>';

        return;
    }

    for (const sample of samples) {

        const before = document.createElement("span");

        before.className = "ba-row before";

        before.textContent =
            `${sample.kind}  ${sample.before}`;

        const after = document.createElement("span");

        after.className = "ba-row after";

        after.textContent = sample.after || "—";

        beforeList.appendChild(before);
        afterList.appendChild(after);
    }
}

function renderCloudPreview() {

    const preview = $("cloudDataPreview");

    const sent =
        state.sanitizedPreview && state.sanitizedPreview.length > 0;

    if (!sent) {

        preview.textContent = "Awaiting analysis…";

    } else {

        preview.innerHTML = highlightMasks(state.sanitizedPreview);
    }

    const flag = $("cloudSentFlag");

    if (state.stages.cloud?.state === "complete") {

        flag.textContent = "Transmitted (sanitized)";

    } else if (state.stages.cloud?.state === "error") {

        flag.textContent = "Not transmitted";

    } else if (sent) {

        flag.textContent = "Generated locally";

    } else {

        flag.textContent = "Not transmitted";
    }
}

function renderCloudReasoning() {

    const cloud = state.stages.cloud || { state: "waiting" };

    const pill = $("reasoningPill");

    pill.className = "pill";

    let status = "Waiting";

    switch (cloud.state) {

        case "processing":
            pill.className = "pill pill-proc";
            pill.textContent = "PROCESSING";
            status = "Analyzing sanitized context…";
            break;

        case "complete":
            pill.className = "pill pill-ok";
            pill.textContent = "COMPLETE";
            status = "Complete — structured action received";
            break;

        case "error":
            pill.className = "pill pill-err";
            pill.textContent = "UNAVAILABLE";
            status = "Unavailable — sanitized data was not sent";
            break;

        default:
            pill.className = "pill pill-idle";
            pill.textContent = "READY";
            status = "Waiting";
            break;
    }

    $("reasoningStatus").textContent = status;

    $("reasoningStatus").dataset.empty = String(cloud.state === "waiting");
}

function renderAction() {

    const action = state.action;

    const pill = $("actionPill");

    const stage = state.stages.action || { state: "waiting" };

    if (stage.state === "complete") {

        pill.className = "pill pill-ok";
        pill.textContent = "✓ EXECUTED";

    } else if (stage.state === "error") {

        pill.className = "pill pill-err";
        pill.textContent = "FAILED";

    } else if (stage.state === "processing") {

        pill.className = "pill pill-proc";
        pill.textContent = "EXECUTING";

    } else {

        pill.className = "pill pill-idle";
        pill.textContent = "—";
    }

    if (action && typeof action.action === "string") {

        $("actionName").textContent = action.action;
        $("actionName").dataset.empty = "false";

        $("actionField").textContent = action.action;
        $("actionField").dataset.empty = "false";

        $("actionTarget").textContent =
            action.target || "(none)";
        $("actionTarget").dataset.empty = String(!action.target);

    } else {

        $("actionName").textContent = "—";
        $("actionName").dataset.empty = "true";

        $("actionField").textContent = "—";
        $("actionField").dataset.empty = "true";

        $("actionTarget").textContent = "—";
        $("actionTarget").dataset.empty = "true";
    }

    $("actionStatus").textContent =
        state.actionStatus || "Waiting";

    $("actionStatus").dataset.empty =
        String(!state.actionStatus);
}

function renderReport() {

    const entities = state.entities || [];

    const scanDone =
        state.stages.detect?.state === "complete" ||
        state.stages.sanitize?.state === "complete" ||
        state.stages.cloud?.state === "complete";

    const detected = $("reportDetected");
    const protectedList = $("reportProtected");
    const sent = $("reportSent");
    const notSent = $("reportNotSent");

    detected.innerHTML = "";
    protectedList.innerHTML = "";
    sent.innerHTML = "";
    notSent.innerHTML = "";

    const formatItem = (label, count, ok) => {

        const li = document.createElement("li");

        li.className = ok ? "mark-ok" : "mark-no";

        const mark = document.createElement("span");

        mark.className = "mark";

        mark.textContent = ok ? "✓" : "✕";

        const text = document.createElement("span");

        text.textContent = label;

        li.appendChild(mark);
        li.appendChild(text);

        if (count !== undefined) {

            const extra = document.createElement("span");

            extra.className = "muted";

            extra.textContent = String(count);

            li.appendChild(extra);
        }

        return li;
    };

    // Detected
    if (entities.length === 0) {

        detected.appendChild(
            formatItem(
                scanDone
                    ? "No sensitive information detected"
                    : "Awaiting analysis…",
                0,
                true
            )
        );

    } else {

        for (const entity of entities) {

            detected.appendChild(
                formatItem(
                    entity.label || "—",
                    entity.count || 0,
                    true
                )
            );
        }
    }

    // Protected locally + NOT sent to cloud
    let protectedCount = 0;

    for (const entity of entities) {

        const label =
            ENTITY_LABELS[entity.label] ||
            entity.label;

        protectedList.appendChild(
            formatItem(
                label,
                undefined,
                true
            )
        );

        notSent.appendChild(
            formatItem(
                label,
                undefined,
                false
            )
        );

        protectedCount += Number(entity.count) || 0;
    }

    if (entities.length === 0) {

        const idleText =
            scanDone
                ? "No sensitive values found"
                : "Awaiting analysis…";

        const idle = document.createElement("li");

        idle.className = "mark-ok";

        const mark = document.createElement("span");

        mark.className = "mark";

        mark.textContent = "✓";

        idle.appendChild(mark);

        const text = document.createElement("span");

        text.textContent = idleText;

        idle.appendChild(text);

        protectedList.appendChild(idle);

        const idle2 = document.createElement("li");

        idle2.className = "mark-no";

        const mark2 = document.createElement("span");

        mark2.className = "mark";

        mark2.textContent = "✕";

        idle2.appendChild(mark2);

        const text2 = document.createElement("span");

        text2.textContent = idleText;

        idle2.appendChild(text2);

        notSent.appendChild(idle2);
    }

    // Sent to cloud
    const sanitizeDone = state.stages.sanitize?.state === "complete";

    sent.appendChild(
        formatItem("Page structure (text)", undefined, sanitizeDone)
    );

    sent.appendChild(
        formatItem("Product / content information", undefined, sanitizeDone)
    );

    sent.appendChild(
        formatItem(
            "Structured action request",
            undefined,
            state.stages.cloud?.state === "complete"
        )
    );

    // Cloud exposure
    $("reportExposure").textContent =
        state.cloudExposure === null || state.cloudExposure === undefined
            ? "—"
            : String(state.cloudExposure);
}

function renderMetrics() {

    const setMetric = (id, value, empty) => {

        const el = $(id);

        el.textContent = value;

        el.dataset.empty = String(empty);
    };

    setMetric(
        "metricNer",
        fmt(state.timing.ner),
        state.timing.ner === undefined
    );

    setMetric(
        "metricRedact",
        fmt(state.timing.redact),
        state.timing.redact === undefined
    );

    setMetric(
        "metricCloud",
        fmt(state.timing.cloud),
        state.timing.cloud === undefined
    );

    setMetric(
        "metricTotal",
        fmt(state.timing.total),
        state.timing.total === undefined
    );

    const detected = totalDetected();

    setMetric(
        "metricDetected",
        detected > 0 ? String(detected) : "—",
        detected === 0
    );

    const protectedCount = countProtected();

    setMetric(
        "metricProtected",
        protectedCount > 0 ? String(protectedCount) : "—",
        protectedCount === 0
    );
}


// ------------------------------------------------------------
// LIVE PERCEPTION
// ------------------------------------------------------------

function scanCompleted() {

    return (
        state.stages.detect?.state === "complete" ||
        state.stages.sanitize?.state === "complete" ||
        state.stages.cloud?.state === "complete"
    );
}

function analysisStatusLabel() {

    if (state.busy) {
        return "ANALYZING";
    }

    if (hasStageError()) {
        return "ERROR";
    }

    if (
        state.stages.action?.state === "complete" ||
        state.stages.cloud?.state === "complete"
    ) {
        return "COMPLETED";
    }

    return "READY";
}

function stageLabel(stageState) {

    if (stageState === "processing") {
        return "PROCESSING";
    }

    if (stageState === "complete") {
        return "✓";
    }

    if (stageState === "error") {
        return "ERROR";
    }

    return "WAITING";
}

function setKv(id, value, empty) {

    const el = $(id);

    if (!el) {
        return;
    }

    el.textContent = value;
    el.dataset.empty = String(empty);
}

function renderPerception() {

    const status = $("perceptStatus");

    if (status) {
        status.textContent = analysisStatusLabel();
    }

    const url = state.page?.url || "";
    const title = state.page?.title || "";

    setKv("perceptUrl", url || "—", !url);
    setKv("perceptTitle", title || "—", !title);

    const nodes = [
        { name: "DOM EXTRACTION", stage: "webpage", timing: "extraction" },
        { name: "LOCAL NER", stage: "ai", timing: "ner" },
        { name: "PRIVACY DETECTION", stage: "detect", timing: null },
        { name: "LOCAL REDACTION", stage: "redact", timing: "redact" },
        { name: "SANITIZATION", stage: "sanitize", timing: null },
        { name: "CLOUD REASONING", stage: "cloud", timing: "cloud" },
        { name: "BROWSER ACTION", stage: "action", timing: "action" }
    ];

    const list = $("perceptNodes");

    if (list) {

        list.innerHTML = "";

        for (const node of nodes) {

            const stageState =
                state.stages[node.stage]?.state || "waiting";

            const li = document.createElement("li");

            li.className = "percept-node";
            li.dataset.state = stageState;

            const name = document.createElement("span");

            name.className = "pn-name";
            name.textContent = node.name;

            const time = document.createElement("span");

            time.className = "pn-time";
            time.textContent =
                node.timing &&
                state.timing[node.timing] !== undefined
                    ? fmt(state.timing[node.timing])
                    : "—";

            const statusEl = document.createElement("span");

            statusEl.className = "pn-state";
            statusEl.textContent = stageLabel(stageState);

            li.appendChild(name);
            li.appendChild(time);
            li.appendChild(statusEl);

            list.appendChild(li);
        }
    }

    const output = $("perceptOutput");

    if (output) {

        output.innerHTML = "";

        const entities = state.entities || [];

        if (entities.length === 0) {

            const row = document.createElement("div");

            row.className = "count-row";

            row.innerHTML =
                `<span class="type" style="color:var(--faint)">` +
                (scanCompleted()
                    ? "NO SENSITIVE DATA"
                    : "AWAITING ANALYSIS") +
                `</span>` +
                `<span class="num" style="color:var(--faint)">—</span>`;

            output.appendChild(row);

        } else {

            for (const entity of entities) {

                const row = document.createElement("div");

                row.className = "count-row";

                const type = document.createElement("span");

                type.className = "type";
                type.textContent = entity.label || "—";

                const num = document.createElement("span");

                num.className = "num";
                num.textContent = String(entity.count || 0);

                row.appendChild(type);
                row.appendChild(num);

                output.appendChild(row);
            }
        }
    }

    renderInspection();
}

function renderInspection() {

    const detected = totalDetected();

    setKv(
        "inspectNodes",
        state.nodeCount ? String(state.nodeCount) : "—",
        !state.nodeCount
    );

    setKv(
        "inspectSensitive",
        detected > 0 ? String(detected) : "—",
        detected === 0
    );

    setKv(
        "inspectRedacted",
        state.redactedCount > 0 ? String(state.redactedCount) : "—",
        !state.redactedCount
    );

    const blocked = state.cloudExposure;

    setKv(
        "inspectBlocked",
        blocked === null || blocked === undefined
            ? "—"
            : String(blocked),
        blocked === null || blocked === undefined
    );

    const sanitizeState =
        state.stages.sanitize?.state || "waiting";

    const sanitized =
        sanitizeState === "complete"
            ? "READY"
            : sanitizeState === "processing"
                ? "GENERATING"
                : "—";

    setKv("inspectSanitized", sanitized, sanitized === "—");

    const cloudState =
        state.stages.cloud?.state || "waiting";

    let tx = "—";

    if (cloudState === "complete") {
        tx = "SANITIZED ONLY";
    } else if (cloudState === "processing") {
        tx = "TRANSMITTING";
    } else if (cloudState === "error") {
        tx = "NOT SENT";
    }

    setKv("inspectTransmission", tx, tx === "—");

    const action = state.action;

    setKv("inspectAction", action?.action || "—", !action?.action);

    setKv("inspectTarget", action?.target || "—", !action?.target);

    const actionStatus = state.actionStatus || "";

    let execution = "—";

    if (
        actionStatus === "Executed" ||
        actionStatus === "No action required"
    ) {
        execution = "SUCCESS";
    } else if (
        actionStatus === "Target not found" ||
        actionStatus === "Unknown action"
    ) {
        execution = "FAILED";
    } else if (actionStatus) {
        execution = actionStatus.toUpperCase();
    }

    setKv("inspectExecution", execution, execution === "—");
}


// ------------------------------------------------------------
// PIPELINE EXECUTION GRAPH
// ------------------------------------------------------------

function graphState(node) {

    if (node.stage === null) {
        return "complete";
    }

    if (node.stage === "action-json") {

        if (state.action && typeof state.action.action === "string") {
            return "complete";
        }

        return state.stages.cloud?.state === "processing"
            ? "processing"
            : "waiting";
    }

    return state.stages[node.stage]?.state || "waiting";
}

function renderPipelineGraph() {

    const graph = $("pipelineGraph");

    if (!graph) {
        return;
    }

    const header = $("graphHeader");

    if (header) {
        header.textContent = analysisStatusLabel();
    }

    const nodes = [
        {
            icon: "🌐",
            name: "BROWSER PAGE",
            desc: "Source context",
            stage: null,
            timing: null
        },
        {
            icon: "📄",
            name: "DOM / SCREEN EXTRACTION",
            desc: "Local extraction",
            stage: "webpage",
            timing: "extraction"
        },
        {
            icon: "🧠",
            name: "LOCAL AI PERCEPTION",
            desc: "NER on-device",
            stage: "ai",
            timing: "ner"
        },
        {
            icon: "🔍",
            name: "SENSITIVE DATA DETECTION",
            desc: "Persons / emails / phones",
            stage: "detect",
            timing: null
        },
        {
            icon: "🛡️",
            name: "LOCAL REDACTION",
            desc: "Mask sensitive values",
            stage: "redact",
            timing: "redact"
        },
        {
            icon: "🔒",
            name: "SANITIZED CONTEXT",
            desc: "Clone-only, live DOM untouched",
            stage: "sanitize",
            timing: null
        },
        {
            icon: "☁️",
            name: "CLOUD AI REASONING",
            desc: "Gemini reasoning",
            stage: "cloud",
            timing: "cloud"
        },
        {
            icon: "⚙️",
            name: "ACTION JSON",
            desc: "Structured action",
            stage: "action-json",
            timing: null
        },
        {
            icon: "🖱️",
            name: "BROWSER ACTION",
            desc: "Original DOM",
            stage: "action",
            timing: "action"
        }
    ];

    graph.innerHTML = "";

    nodes.forEach((node, index) => {

        if (index > 0) {

            const arrow = document.createElement("div");

            arrow.className = "g-arrow";
            arrow.textContent = "▼";

            graph.appendChild(arrow);
        }

        const stateName = graphState(node);

        const box = document.createElement("div");

        box.className = "g-node";
        box.dataset.state = stateName;

        const icon = document.createElement("span");

        icon.className = "g-icon";
        icon.textContent = node.icon;

        const body = document.createElement("div");

        body.className = "g-body";

        const name = document.createElement("div");

        name.className = "g-name";
        name.textContent = node.name;

        const desc = document.createElement("div");

        desc.className = "g-desc";
        desc.textContent = node.desc;

        body.appendChild(name);
        body.appendChild(desc);

        const meta = document.createElement("div");

        meta.className = "g-meta";

        const glyph = document.createElement("span");

        glyph.className = "g-glyph";

        if (stateName === "complete") {
            glyph.textContent = "✓";
        } else if (stateName === "processing") {
            glyph.textContent = "…";
        } else if (stateName === "error") {
            glyph.textContent = "✕";
        } else {
            glyph.textContent = "·";
        }

        const timingLabel = document.createElement("span");

        timingLabel.className = "g-time";

        timingLabel.textContent =
            node.timing && state.timing[node.timing] !== undefined
                ? fmt(state.timing[node.timing])
                : (stateName === "complete" ? "✓" : "");

        meta.appendChild(glyph);
        meta.appendChild(timingLabel);

        box.appendChild(icon);
        box.appendChild(body);
        box.appendChild(meta);

        graph.appendChild(box);
    });
}


// ------------------------------------------------------------
// LOGS
// ------------------------------------------------------------

function renderLogs() {

    const view = $("logView");

    if (!view) {
        return;
    }

    const filter = $("logFilter").value;

    const query = ($("logSearch").value || "").trim().toLowerCase();

    const autoscroll = $("logAutoscroll") && $("logAutoscroll").checked;

    const preserveScroll = !autoscroll;

    let previousScroll = 0;

    if (preserveScroll) {
        previousScroll = view.scrollTop;
    }

    view.innerHTML = "";

    const entries = (state.logs || []).filter((entry) => {

        if (filter !== "ALL" && entry.level !== filter) {
            return false;
        }

        if (
            query &&
            !entry.message.toLowerCase().includes(query) &&
            !entry.level.toLowerCase().includes(query)
        ) {
            return false;
        }

        return true;
    });

    if (entries.length === 0) {

        const empty = document.createElement("div");

        empty.className = "log-empty";

        empty.textContent =
            (state.logs || []).length === 0
                ? "No log entries yet."
                : "No entries match the current filter / search.";

        view.appendChild(empty);

        return;
    }

    for (const entry of entries) {

        const row = document.createElement("div");

        row.className = "log-row";

        const time = document.createElement("span");

        time.className = "log-time";
        time.textContent = entry.time || "–";

        const level = document.createElement("span");

        level.className = "log-level lv-" + (entry.level || "INFO");
        level.textContent = entry.level || "INFO";

        const msg = document.createElement("span");

        msg.className = "log-msg";
        msg.textContent = entry.message || "";

        row.appendChild(time);
        row.appendChild(level);
        row.appendChild(msg);

        view.appendChild(row);
    }

    if (autoscroll) {
        view.scrollTop = view.scrollHeight;
    } else {
        view.scrollTop = previousScroll;
    }
}


// ------------------------------------------------------------
// BOOT
// ------------------------------------------------------------

bindEvents();
prime();