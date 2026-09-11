import { defineConfig } from "vite";

export default defineConfig({
    build: {
        outDir: "dist",
        emptyOutDir: true,

        rollupOptions: {
            input: {
                ai: "src/ai.js",
                vision: "src/vision.js"
            },

            output: {
                format: "es",
                entryFileNames: "[name].mjs"
            },

            preserveEntrySignatures: "strict"
        }
    }
});