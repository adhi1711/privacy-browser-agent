import { pipeline } from "@huggingface/transformers";

console.log("Transformers.js loaded!");

let ner = null;
let modelReady = false;


// ========================================
// LOAD NER MODEL
// ========================================

async function loadModel() {

    console.log("Loading NER model...");

    ner = await pipeline(
        "token-classification",
        "Xenova/bert-base-NER"
    );

    modelReady = true;

    console.log("NER model loaded!");

    window.postMessage(
        {
            type: "AI_READY"
        },
        "*"
    );
}


// ========================================
// ANALYZE TEXT
// ========================================

async function analyzeText(text) {

    console.log(
        "Analyzing webpage text:"
    );

    const results = await ner(text);

    console.log(
        "Raw entities:",
        results
    );

    const entities = [];

    for (const item of results) {

        let type = item.entity;

        type = type.replace(
            "B-",
            ""
        );

        type = type.replace(
            "I-",
            ""
        );

        entities.push({

            type: type,

            text: item.word,

            score: item.score

        });
    }

    console.log(
        "Detected entities:",
        entities
    );

    return entities;
}


// ========================================
// LISTEN FOR WEBPAGE TEXT
// ========================================

window.addEventListener(
    "message",
    async (event) => {

        if (
            event.data?.type !==
            "ANALYZE_TEXT"
        ) {
            return;
        }

        if (!modelReady) {

            console.log(
                "Model is still loading..."
            );

            return;
        }

        const text =
            event.data.text;

        try {

            const entities =
                await analyzeText(text);

            window.postMessage(
                {
                    type: "AI_RESULT",
                    result: entities
                },
                "*"
            );

        } catch (error) {

            console.error(
                "NER error:",
                error
            );

        }
    }
);


// ========================================
// START MODEL
// ========================================

loadModel();