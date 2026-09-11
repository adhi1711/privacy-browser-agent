require("dotenv").config();

const { GoogleGenAI, Type } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

async function test() {

    try {

        const response = await ai.models.generateContent({

            model: "gemini-3.5-flash-lite",

            contents: "Return the browser action for this test. The action must be NONE.",

            config: {

                responseMimeType: "application/json",

                responseSchema: {

                    type: Type.OBJECT,

                    properties: {

                        action: {
                            type: Type.STRING,
                            enum: ["NONE"]
                        }

                    },

                    required: ["action"]
                }
            }
        });

        console.log("RAW RESPONSE:");
        console.log(response.text);

    } catch (error) {

        console.error("ERROR:");
        console.error(error);

    }
}

test();