// ========================================
// PRIVACY BROWSER AGENT - CONTENT SCRIPT
// ========================================
// Loads the local AI module, runs the privacy
// pipeline, reports live status to the popup,
// and confirms redacting happens BEFORE cloud
// transmission.
//
// Communication protocol (popup <-> content):
//
// popup -> content:
//   { type: "PBA_PING" }                    (is the agent alive on this tab?)
//   { type: "PBA_GET_STATE" }               (restore last pipeline state)
//   { type: "PBA_ANALYZE" }                 (start the privacy pipeline)
//   { type: "PBA_CLEAR_LOGS" }              (clear the session log viewer)
//
// content -> popup:
//   { type: "PBA_STATE", state: { ... } }   (full pipeline snapshot)

// ========================================
// LOAD LOCAL AI MODULE
// ========================================

(function injectAiModule() {

    // Guard against double injection (extension reload, etc.)
    if (document.documentElement.hasAttribute("data-pba-ai")) {
        return;
    }

    const script = document.createElement("script");

    script.type = "module";

    script.src = chrome.runtime.getURL(
        "dist/ai.mjs"
    );

    document.documentElement.appendChild(script);

    document.documentElement.setAttribute(
        "data-pba-ai",
        "1"
    );

    console.log("AI module injected!");
})();


// ========================================
// PIPELINE STATE
// ========================================

const STAGE_NAMES = [
    "webpage",
    "ai",
    "detect",
    "redact",
    "sanitize",
    "cloud",
    "action"
];

let pendingAnalysis = false;

const sessionLogs = [];

const MAX_SESSION_LOGS = 200;

let logCounter = 0;

const lastRun = {
    busy: false,
    aiReady: false,
    startedAt: null,
    stages: makeFreshStages(),
    entities: [],
    samples: [],
    cloudExposure: null,
    sanitizedPreview: "",
    action: null,
    actionStatus: "",
    timing: {},
    nodeCount: 0,
    redactedCount: 0,
    pageHTML: "",
    error: null
};

function makeFreshStages() {

    const stages = {};

    for (const name of STAGE_NAMES) {
        stages[name] = {
            state: "waiting",
            detail: ""
        };
    }

    return stages;
}


// ========================================
// SESSION LOGS
// ========================================
// Logs live in extension memory for the current
// session. Raw sensitive values are never logged.

function log(level, message) {

    const now = new Date();

    const time =
        [now.getHours(), now.getMinutes(), now.getSeconds()]
            .map(value => String(value).padStart(2, "0"))
            .join(":");

    sessionLogs.push({
        id: logCounter,
        time: time,
        level: level,
        message: message
    });

    logCounter += 1;

    if (sessionLogs.length > MAX_SESSION_LOGS) {

        sessionLogs.splice(
            0,
            sessionLogs.length - MAX_SESSION_LOGS
        );
    }

    publish();
}

function stagesHaveError() {

    return STAGE_NAMES.some(
        name => lastRun.stages[name]?.state === "error"
    );
}


// ========================================
// POPUP NOTIFICATION
// ========================================

function notify(message) {

    try {

        chrome.runtime.sendMessage(message)
            .catch(() => {
                // No receiver (popup closed) - safe to ignore.
            });

    } catch (error) {
        // ignore - messaging must never break the page pipeline.
    }
}

function setStage(name, state, detail) {

    lastRun.stages[name] = {
        state: state,
        detail: detail || ""
    };
}

function publish() {

    notify({
        type: "PBA_STATE",
        state: getStatePayload()
    });
}

function getStatePayload() {

    return {
        busy: lastRun.busy,
        aiReady: lastRun.aiReady,
        page: {
            url: location.href,
            title: document.title
        },
        logs: sessionLogs,
        nodeCount: lastRun.nodeCount,
        redactedCount: lastRun.redactedCount,
        stages: lastRun.stages,
        entities: lastRun.entities,
        samples: lastRun.samples,
        cloudExposure: lastRun.cloudExposure,
        sanitizedPreview: lastRun.sanitizedPreview,
        action: lastRun.action,
        actionStatus: lastRun.actionStatus,
        timing: { ...lastRun.timing },
        error: lastRun.error
    };
}

function roundMs(ms) {

    return Math.round(ms);

}


// ========================================
// POPUP REQUESTS
// ========================================

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (!message || typeof message.type !== "string") {
            return;
        }

        if (message.type === "PBA_PING") {

            sendResponse({
                ok: true,
                aiReady: lastRun.aiReady
            });

            return;
        }

        if (message.type === "PBA_GET_STATE") {

            sendResponse({
                ok: true,
                state: getStatePayload()
            });

            return;
        }

        if (message.type === "PBA_ANALYZE") {

            const result = startAnalysis();

            sendResponse(result);
        }

        if (message.type === "PBA_CLEAR_LOGS") {

            sessionLogs.length = 0;

            sendResponse({ ok: true });
        }
    }
);


// ========================================
// LISTEN FOR AI MODULE MESSAGES
// ========================================

window.addEventListener("message", (event) => {

    // ----------------------------------------
    // AI READY
    // ----------------------------------------

    if (event.data?.type === "AI_READY") {

        console.log("AI is ready!");

        lastRun.aiReady = true;

        log("AI", "Local NER model ready");

        publish();

        if (pendingAnalysis) {

            pendingAnalysis = false;

            runPipeline();
        }
    }


    // ----------------------------------------
    // AI RESULT
    // ----------------------------------------

    if (event.data?.type === "AI_RESULT") {

        console.log(
            "AI detected:",
            event.data.result
        );

        lastRun.timing.ner =
            roundMs(
                performance.now() -
                (lastRun.timing.nerStart || performance.now())
            );

        maskPrivateInformation(
            event.data.result
        );
    }
});


// ========================================
// START ANALYSIS
// ========================================

function startAnalysis() {

    if (lastRun.busy) {

        log("INFO", "Analysis already in progress");

        return {
            ok: false,
            reason: "busy"
        };
    }

    if (!lastRun.aiReady) {

        pendingAnalysis = true;

        log("AI", "Analysis queued — waiting for local NER model");

        setStage("ai", "processing");

        publish();

        scheduleAiTimeout();

        console.log(
            "Waiting for local AI to become ready..."
        );

        return {
            ok: true,
            queued: true
        };
    }

    runPipeline();

    return {
        ok: true
    };
}

function scheduleAiTimeout() {

    setTimeout(() => {

        if (lastRun.aiReady || !pendingAnalysis) {
            return;
        }

        pendingAnalysis = false;

        lastRun.busy = false;

        lastRun.error = "Local AI unavailable";

        setStage("ai", "error", "Local AI unavailable");

        log("ERROR", "Local AI unavailable");

        publish();

    }, 90 * 1000);
}


// ========================================
// RUN PIPELINE
// ========================================

function runPipeline() {

    if (lastRun.busy) {
        return;
    }

    lastRun.busy = true;

    lastRun.startedAt = performance.now();

    lastRun.stages = makeFreshStages();

    lastRun.entities = [];

    lastRun.samples = [];

    lastRun.cloudExposure = null;

    lastRun.sanitizedPreview = "";

    lastRun.action = null;

    lastRun.actionStatus = "";

    lastRun.timing = {};

    lastRun.nodeCount = 0;

    lastRun.redactedCount = 0;

    lastRun.error = null;

    log("INFO", "Page analysis started");

    publish();

    // --------------------------------
    // STAGE 1: EXTRACT WEBPAGE TEXT
    // --------------------------------

    setStage("webpage", "processing");

    publish();

    const extractionStart = performance.now();

    const clonedBody = document.body.cloneNode(true);

    clonedBody
        .querySelectorAll(
            "script, style, noscript"
        )
        .forEach(element => {
            element.remove();
        });

    const pageText = clonedBody.innerText;

    const pageHTML = clonedBody.innerHTML;

    lastRun.pageHTML = pageHTML;

    lastRun.timing.extraction =
        roundMs(performance.now() - extractionStart);

    lastRun.nodeCount =
        countNodes(clonedBody);

    setStage(
        "webpage",
        "complete",
        pageText.length + " chars extracted locally"
    );

    log(
        "INFO",
        "DOM extraction completed (" +
        pageText.length + " chars, " +
        lastRun.nodeCount + " nodes)"
    );

    console.log(
        "Sending webpage text to local AI..."
    );

    // --------------------------------
    // STAGE 2: LOCAL AI (NER)
    // --------------------------------

    setStage("ai", "processing");

    publish();

    lastRun.timing.nerStart = performance.now();

    window.postMessage(
        {
            type: "ANALYZE_TEXT",
            text: pageText
        },
        "*"
    );

    log("AI", "Page text sent to local NER model");
}


// ========================================
// GROUP NER TOKENS INTO ENTITIES
// ========================================

function mergeEntities(entities) {

    const merged = [];

    let current = null;

    for (const entity of entities) {

        if (!entity) {
            continue;
        }

        if (
            typeof entity.text !== "string" ||
            entity.text.length === 0
        ) {
            continue;
        }

        if (
            typeof entity.score === "number" &&
            entity.score < 0.75
        ) {
            continue;
        }

        if (
            entity.type !== "PER" &&
            entity.type !== "LOC" &&
            entity.type !== "ORG"
        ) {
            continue;
        }

        if (
            current &&
            current.type === entity.type
        ) {

            let token = entity.text;

            if (token.startsWith("##")) {
                token = token.slice(2);
            }

            current.text += token;

            current.score = Math.max(
                current.score,
                entity.score
            );

        } else {

            let token = entity.text;

            if (token.startsWith("##")) {
                token = token.slice(2);
            }

            current = {
                type: entity.type,
                text: token,
                score: entity.score
            };

            merged.push(current);
        }
    }

    return merged;
}


// ========================================
// MASK PRIVATE INFORMATION
// ========================================

function maskPrivateInformation(entities) {

    const emailPattern =
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    const phonePattern =
        /\b\d{10}\b/g;

    const pageHTML =
        lastRun.pageHTML ||
        cloneCleanHtml();

    const pageText =
        pageHTML
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const mergedEntities =
        mergeEntities(entities);

    log(
        "AI",
        "Local NER returned " +
        mergedEntities.length +
        " entities"
    );

    // ----------------------------------------
    // DETECTION (counts are real, not synthetic)
    // ----------------------------------------

    setStage("detect", "processing");

    publish();

    const emails = uniqueStrings(
        pageText.match(emailPattern) || []
    );

    const phones = uniqueStrings(
        pageText.match(phonePattern) || []
    );

    const categories = [];

    const addCategory = (label, count) => {

        if (count > 0) {
            categories.push({
                label: label,
                count: count
            });
        }
    };

    addCategory(
        "PERSON",
        mergedEntities.filter(entity =>
            entity.type === "PER"
        ).length
    );

    addCategory(
        "EMAIL",
        emails.length
    );

    addCategory(
        "PHONE",
        phones.length
    );

    addCategory(
        "LOCATION",
        mergedEntities.filter(entity =>
            entity.type === "LOC"
        ).length
    );

    addCategory(
        "ORGANIZATION",
        mergedEntities.filter(entity =>
            entity.type === "ORG"
        ).length
    );

    lastRun.entities = categories;

    lastRun.samples =
        buildSamples(
            mergedEntities,
            emails,
            phones
        );

    log(
        "PRIVACY",
        lastRun.nodeCount + " DOM/text nodes inspected"
    );

    for (const category of categories) {
        log("PRIVACY", category.label + " detected");
    }

    setStage("detect", "complete");
    publish();

    const redactStart = performance.now();

    setStage("redact", "processing");
    publish();

    // ----------------------------------------
    // REDACTION - CLONE ONLY
    // ----------------------------------------
    // Sanitization runs on a cloned representation
    // (createSanitizedRepresentation). The live
    // page is NEVER modified, so interactive labels
    // like "Add to Cart" stay intact in the DOM.

    const sanitizedRep =
        createSanitizedRepresentation(
            mergedEntities
        );

    const sanitizedText =
        sanitizedRep.text;

    console.log("Sanitized text before sending:");
    console.log(sanitizedText);

    lastRun.timing.redact =
        roundMs(performance.now() - redactStart);

    lastRun.sanitizedPreview =
        sanitizedText.slice(0, 600);

    // Sensitive information PREVENTED from reaching
    // Gemini (not placeholder leftovers).
    lastRun.cloudExposure =
        sanitizedRep.prevented;

    lastRun.redactedCount =
        sanitizedRep.prevented;

    setStage("redact", "complete");
    setStage("sanitize", "complete");
    publish();

    log(
        "PRIVACY",
        "Local redaction completed — " +
        sanitizedRep.prevented + " values masked"
    );

    log(
        "PRIVACY",
        sanitizedRep.prevented +
        " sensitive values blocked from cloud"
    );

    log("INFO", "Sanitized context generated");

    // ----------------------------------------
    // PROTECT THE ORIGINAL DOM
    // ----------------------------------------
    // The live page is NEVER modified. Sanitization
    // happens only on the cloned representation above,
    // so interactive elements (button, a, input,
    // [role="button"]) and their event listeners are
    // preserved. Browser actions always search the
    // original, untouched DOM.

    console.log(
        "🔒 Live DOM left untouched — sanitized context sent to cloud."
    );

    sendToBackend(sanitizedText);
}

// Interactive elements keep their exact text in the
// sanitized representation so the cloud AI can still
// reference the real target ("Add to Cart").
const INTERACTIVE_SELECTOR =
    "button, a, input, textarea, select, " +
    "[role='button'], [contenteditable]";

function escapeRegExp(text) {

    return String(text).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

function isInteractive(element) {

    return Boolean(
        element &&
        element.closest(INTERACTIVE_SELECTOR)
    );
}

function maskForEntityType(type) {

    if (type === "PER") {
        return "[PERSON]";
    }

    if (type === "LOC") {
        return "[LOCATION]";
    }

    if (type === "ORG") {
        return "[ORGANIZATION]";
    }

    return null;
}


// ========================================
// BUILD SANITIZED REPRESENTATION
// ========================================
// Clones the live document, strips non-content
// elements, then masks every text node:
//
//   - email / phone patterns always (reliable)
//   - NER entities only OUTSIDE interactive
//     elements, matched as whole words
//
// Returns { html, text, prevented } where
// "prevented" = sensitive values blocked from
// the cloud transmission.

function createSanitizedRepresentation(mergedEntities) {

    const clone = document.body.cloneNode(true);

    clone
        .querySelectorAll("script, style, noscript, template")
        .forEach(element => {
            element.remove();
        });

    const maskSequences = mergedEntities
        .filter(entity =>
            entity.text &&
            entity.text.length > 0 &&
            maskForEntityType(entity.type)
        )
        .map(entity => ({
            text: entity.text,
            regex: new RegExp(
                "\\b" + escapeRegExp(entity.text) + "\\b",
                "g"
            ),
            mask: maskForEntityType(entity.type)
        }));

    const nodes = [];

    const textNodes =
        document.createTreeWalker(
            clone,
            NodeFilter.SHOW_TEXT
        );

    while (textNodes.nextNode()) {
        nodes.push(textNodes.currentNode);
    }

    let prevented = 0;

    for (const node of nodes) {

        if (!node.nodeValue) {
            continue;
        }

        const parent = node.parentElement;

        if (!parent) {
            continue;
        }

        const interactive =
            isInteractive(parent);

        const original = node.nodeValue;

        let masked =
            original
                .replace(
                    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
                    () => {
                        prevented++;
                        return "[EMAIL]";
                    }
                )
                .replace(
                    /\b\d{10}\b/g,
                    () => {
                        prevented++;
                        return "[PHONE]";
                    }
                );

        if (!interactive) {

            for (const sequence of maskSequences) {

                const before = masked;

                masked =
                    masked.replace(
                        sequence.regex,
                        () => {
                            prevented++;
                            return sequence.mask;
                        }
                    );

                if (masked !== before) {
                    console.log(
                        "Masked:",
                        sequence.text,
                        "→",
                        sequence.mask
                    );
                }
            }
        }

        if (masked !== original) {
            node.nodeValue = masked;
        }
    }

    return {
        html: clone.innerHTML,
        text: clone.innerText
            .replace(/\s+/g, " ")
            .trim(),
        prevented: prevented
    };
}

function cloneCleanHtml() {

    const clonedBody =
        document.body.cloneNode(true);

    clonedBody
        .querySelectorAll("script, style, noscript")
        .forEach(element => {
            element.remove();
        });

    return clonedBody.innerHTML;
}

function uniqueStrings(list) {

    return Array.from(new Set(list));
}

function countNodes(root) {

    const textWalker =
        document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT
        );

    let textCount = 0;

    while (textWalker.nextNode()) {
        textCount += 1;
    }

    return (
        root.querySelectorAll("*").length +
        textCount
    );
}


// ========================================
// SAMPLE DATA FOR THE POPUP
// ========================================

function buildSamples(
    mergedEntities,
    emails,
    phones
) {

    const samples = [];

    const pushSamples = (kind, values) => {

        const masked =
            kind === "PERSON" ? "[PERSON]" :
            kind === "EMAIL" ? "[EMAIL]" :
            kind === "PHONE" ? "[PHONE]" :
            kind === "LOCATION" ? "[LOCATION]" :
            "[ORGANIZATION]";

        for (const value of values.slice(0, 3)) {

            samples.push({
                kind: kind,
                before: value,
                after: masked
            });
        }
    };

    const persons =
        mergedEntities
            .filter(entity => entity.type === "PER")
            .map(entity => entity.text);

    const locations =
        mergedEntities
            .filter(entity => entity.type === "LOC")
            .map(entity => entity.text);

    const organizations =
        mergedEntities
            .filter(entity => entity.type === "ORG")
            .map(entity => entity.text);

    pushSamples("PERSON", persons);
    pushSamples("EMAIL", emails);
    pushSamples("PHONE", phones);
    pushSamples("LOCATION", locations);
    pushSamples("ORGANIZATION", organizations);

    return samples;
}


// ========================================
// SEND SANITIZED TEXT TO BACKEND
// ========================================

async function sendToBackend(sanitizedText) {

    const cloudStart = performance.now();

    setStage("cloud", "processing");
    publish();

    log("CLOUD", "Sanitized context sent to cloud (text only)");

    console.log(
        "Sending sanitized text to backend..."
    );

    try {

        const response = await fetch(
            "http://localhost:3000/analyze",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text: sanitizedText
                })
            }
        );

        const data = await response.json();

        lastRun.timing.cloud =
            roundMs(performance.now() - cloudStart);

        console.log(
            "Gemini response from backend:",
            data.result
        );

        let action = null;

        try {

            action = JSON.parse(data.result);

        } catch (error) {

            console.error(
                "Could not parse Gemini action:",
                error
            );
        }

        if (
            !action ||
            typeof action.action !== "string"
        ) {

            throw new Error("invalid_action");
        }

        console.log("Browser action:", action);

        lastRun.action = action;

        log("CLOUD", "Action received: " + action.action);

        setStage("cloud", "complete");
        publish();

        executeBrowserAction(action);

    } catch (error) {

        console.error("Backend error:", error);

        lastRun.timing.cloud =
            roundMs(performance.now() - cloudStart);

        lastRun.error =
            "Cloud reasoning unavailable";

        log("ERROR", "Cloud reasoning unavailable");

        setStage(
            "cloud",
            "error",
            "Cloud reasoning unavailable"
        );

        setStage("action", "waiting");

        finishRun();
    }
}


// ========================================
// EXECUTE BROWSER ACTION
// ========================================

function executeBrowserAction(action) {

    console.log(
        "Executing browser action:",
        action
    );

    setStage("action", "processing");
    publish();

    const actionStart = performance.now();

    // --------------------------------
    // NONE
    // --------------------------------

    if (action.action === "NONE") {

        console.log(
            "No browser action required."
        );

        lastRun.actionStatus =
            "No action required";

        lastRun.timing.action =
            roundMs(performance.now() - actionStart);

        log("ACTION", "No browser action required");

        setStage("action", "complete");

        finishRun();

        return;
    }


    // --------------------------------
    // CLICK
    // --------------------------------

    if (action.action === "CLICK") {

        const target = action.target;

        const elements =
            document.querySelectorAll(
                "button, a, input[type='button'], input[type='submit']"
            );

        for (const element of elements) {

            const text =
                element.innerText ||
                element.value ||
                element.getAttribute(
                    "aria-label"
                ) ||
                "";

            if (
                text.trim().toLowerCase() ===
                target.trim().toLowerCase()
            ) {

                console.log("Clicking:", text);

                element.click();

                lastRun.actionStatus =
                    "Executed";

                lastRun.timing.action =
                    roundMs(performance.now() - actionStart);

                log("ACTION", "Browser action executed: CLICK");

                setStage("action", "complete");

                finishRun();

                return;
            }
        }


        console.log(
            "Could not find clickable element:",
            target
        );

        lastRun.actionStatus =
            "Target not found";

        lastRun.error =
            "Action could not be executed";

        lastRun.timing.action =
            roundMs(performance.now() - actionStart);

        log("ERROR", "Action could not be executed — target not found");

        setStage(
            "action",
            "error",
            "Could not find target: " + target
        );

        finishRun();

        return;
    }


    // --------------------------------
    // SCROLL
    // --------------------------------

    if (action.action === "SCROLL") {

        window.scrollBy({
            top: 500,
            behavior: "smooth"
        });

        console.log("Page scrolled.");

        lastRun.actionStatus = "Executed";

        lastRun.timing.action =
            roundMs(performance.now() - actionStart);

        log("ACTION", "Page scrolled");

        setStage("action", "complete");

        finishRun();

        return;
    }


    // --------------------------------
    // TYPE
    // --------------------------------

    if (action.action === "TYPE") {

        console.log("TYPE action received.");

        lastRun.actionStatus =
            "TYPE received (no field targeted)";

        lastRun.timing.action =
            roundMs(performance.now() - actionStart);

        log("ACTION", "TYPE action received");

        setStage("action", "complete");

        finishRun();

        return;
    }


    // --------------------------------
    // UNKNOWN ACTION
    // --------------------------------

    console.log(
        "Unknown browser action:",
        action.action
    );

    lastRun.actionStatus =
        "Unknown action";

    lastRun.error =
        "Action could not be executed";

    lastRun.timing.action =
        roundMs(performance.now() - actionStart);

    log("ERROR", "Unknown browser action");

    setStage("action", "error", "Unknown action");

    finishRun();
}


// ========================================
// FINISH RUN
// ========================================

function finishRun() {

    lastRun.busy = false;

    if (lastRun.startedAt) {

        lastRun.timing.total =
            roundMs(
                performance.now() - lastRun.startedAt
            );
    }

    if (stagesHaveError()) {

        log("ERROR", "Analysis finished with errors");

    } else {

        log("SUCCESS", "Analysis completed");
    }

    publish();
}


// ========================================
// INITIAL STATE
// ========================================

publish();