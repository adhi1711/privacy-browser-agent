require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const { GoogleGenAI, Type } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

app.get("/", (req, res) => {
    res.send("Privacy Browser Agent server is running!");
});

app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/test.html", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "test.html"));
});

app.post("/analyze", async (req, res) => {

    const text = req.body.text;

    console.log("Received sanitized text:");
    console.log(text);

    try {

        const response = await ai.models.generateContent({

            model: "gemini-3.5-flash-lite",

            contents: `
You are a browser automation agent.

Analyze the sanitized webpage text below.

Your job is to decide whether the browser should perform an action.

Available actions:

NONE
CLICK
SCROLL
TYPE

Rules:

1. Use CLICK when there is a relevant clickable button or link that the user should interact with.
2. Use SCROLL when the required information or relevant content appears to be further down the page.
3. Use TYPE only when text needs to be entered into an input field.
4. Use NONE when no action is necessary.
5. For CLICK, put the exact visible text of the button or link in "target".
6. For NONE and SCROLL, use an empty string for "target".
7. Do not invent buttons, links, or targets that are not present in the webpage text.

Sanitized webpage:

${text}
`,

            config: {
                responseMimeType: "application/json",

                responseSchema: {
                    type: Type.OBJECT,

                    properties: {

                        action: {
                            type: Type.STRING,
                            enum: [
                                "NONE",
                                "CLICK",
                                "SCROLL",
                                "TYPE"
                            ]
                        },

                        target: {
                            type: Type.STRING
                        }

                    },

                    required: [
                        "action",
                        "target"
                    ]
                }
            }

        });

        console.log("Gemini response:");
        console.log(response.text);

        res.json({
            result: response.text
        });

    } catch (error) {

        console.error("Gemini error:");
        console.error(error);

        res.status(500).json({
            error: "Gemini request failed"
        });
    }
});

app.listen(3000, () => {

    console.log(
        "Server running on http://localhost:3000"
    );

});