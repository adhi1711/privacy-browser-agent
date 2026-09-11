import {
    pipeline,
    env
} from "@huggingface/transformers";

console.log("Vision AI module loaded!");

env.backends.onnx.wasm.wasmPaths =
    chrome.runtime.getURL(
        "dist/onnxruntime/"
    );

let detector = null;

async function loadVisionModel() {

    console.log("Loading vision model...");

    detector = await pipeline(
        "object-detection",
        "Xenova/yolos-tiny"
    );

    console.log("Vision model loaded!");
}

export async function analyzeScreenshot(canvas) {

    if (!detector) {
        await loadVisionModel();
    }

    console.log(
        "Analyzing screenshot with vision AI..."
    );

    const imageDataURL =
        canvas.toDataURL("image/png");

    console.log(
        "Screenshot converted to data URL"
    );

    console.log(
        "Sending screenshot to YOLOS..."
    );

    const results =
        await detector(
            imageDataURL,
            {
                threshold: 0.01
            }
        );

    console.log(
        "Vision detection results:",
        results
    );

    return results;
}