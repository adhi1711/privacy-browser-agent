\# Privacy Browser Agent



\### On-device Visual Perception for Lightweight Browser Agents



Privacy Browser Agent is a Chrome extension prototype that adds a \*\*local privacy layer to AI-powered browser automation\*\*.



Instead of sending an entire webpage directly to a cloud AI model, the extension first analyzes the webpage locally, detects sensitive information, and creates a sanitized version of the content.



Only the sanitized context is sent to the cloud AI for reasoning. The browser then executes the returned action locally on the original webpage.



> \*\*Local AI protects → Cloud AI reasons → Browser executes\*\*



\---



\## Why We Built This



AI browser agents need access to webpage information to understand a page and decide what action to take.



However, webpages can also contain sensitive information such as:



\* Names

\* Email addresses

\* Phone numbers

\* Locations

\* Organizations

\* Other personal information



Sending the complete webpage directly to a cloud AI model can create unnecessary privacy risks.



Our approach places a \*\*privacy layer on the user's device before cloud processing\*\*.



\---



\## How It Works



The system follows this workflow:



```text

Webpage

&#x20;  │

&#x20;  ▼

Local Webpage Extraction

&#x20;  │

&#x20;  ▼

Local AI / NER

&#x20;  │

&#x20;  ▼

Sensitive Information Detection

&#x20;  │

&#x20;  ▼

Local Sanitization

&#x20;  │

&#x20;  ▼

Sanitized Context

&#x20;  │

&#x20;  ▼

Cloud AI

&#x20;  │

&#x20;  ▼

Structured Action

&#x20;  │

&#x20;  ▼

Original Webpage

&#x20;  │

&#x20;  ▼

Browser Action

```



The important part is that \*\*sensitive values are processed locally before cloud communication\*\*.



The cloud AI receives a sanitized representation instead of the original private values.



\---



\## Privacy Approach



The extension keeps the \*\*original webpage DOM unchanged\*\*.



Instead, it creates a separate sanitized representation that is used for cloud reasoning.



\### Example



Original webpage:



```text

Name: Adhithya Venkatesh

Email: adhithya@example.com

Phone: 9876543210

Location: Chennai

```



Sanitized context sent for cloud reasoning:



```text

Name: \[PERSON]

Email: \[EMAIL]

Phone: \[PHONE]

Location: \[LOCATION]

```



This allows the cloud AI to understand the structure and meaning of the webpage without receiving the actual sensitive values.



The original DOM remains available locally so that browser actions can still be performed.



\---



\## Local AI



Sensitive information detection runs locally inside the browser using \*\*Hugging Face Transformers.js\*\*.



The current prototype uses:



```text

Xenova/bert-base-NER

```



The model performs Named Entity Recognition (NER) to identify entities that may contain sensitive information.



Running this analysis locally creates the privacy boundary \*\*before webpage context is sent to the cloud\*\*.



\---



\## Cloud Reasoning



After local sanitization, the sanitized webpage context is sent to our backend.



The backend uses \*\*Google Gemini\*\* to reason about the webpage and determine the appropriate browser action.



The current prototype supports:



```text

NONE

CLICK

SCROLL

TYPE

```



For example, the cloud model can return:



```json

{

&#x20; "action": "CLICK",

&#x20; "target": "Add to Cart"

}

```



The extension then searches for `"Add to Cart"` in the \*\*original DOM\*\* and performs the action locally.



This means the cloud decides \*\*what should happen\*\*, while the browser performs the action \*\*locally\*\*.



\---



\## Experimental Vision Pipeline



The project also includes an experimental local vision pipeline using:



\* YOLOS-Tiny

\* Transformers.js

\* ONNX Runtime

\* WebAssembly



The pipeline can capture a screenshot and perform local object detection.



```text

Screenshot

&#x20;   │

&#x20;   ▼

Canvas

&#x20;   │

&#x20;   ▼

YOLOS-Tiny

&#x20;   │

&#x20;   ▼

Local Detection

```



\### Current Status



The vision component is currently \*\*experimental\*\*.



The main working prototype uses DOM/text extraction and local NER for privacy protection and browser actions.



The vision pipeline provides a foundation for future versions where important webpage information may not be reliably available through the DOM alone.



\---



\## System Architecture



\### Traditional Browser Agent



```text

Webpage

&#x20;  │

&#x20;  ▼

Cloud AI

&#x20;  │

&#x20;  ▼

Browser Action

```



In this approach, webpage context can be sent directly to the cloud.



\### Privacy Browser Agent



```text

Webpage

&#x20;  │

&#x20;  ▼

Local Privacy Layer

&#x20;  │

&#x20;  ▼

Sanitized Context

&#x20;  │

&#x20;  ▼

Cloud AI

&#x20;  │

&#x20;  ▼

Browser Action

```



The key difference is the \*\*local privacy boundary between the webpage and cloud AI\*\*.



> \*\*The cloud should only see the information it actually needs.\*\*



\---



\## Technology Stack



| Area                | Technology                   |

| ------------------- | ---------------------------- |

| Browser Extension   | Chrome Manifest V3           |

| Frontend            | HTML, CSS, JavaScript        |

| Browser Interaction | JavaScript DOM APIs          |

| Local AI            | Hugging Face Transformers.js |

| NER Model           | Xenova/BERT-base-NER         |

| AI Runtime          | ONNX Runtime / WebAssembly   |

| Vision              | YOLOS-Tiny                   |

| Backend             | Node.js                      |

| API Framework       | Express.js                   |

| Cloud AI            | Google Gemini                |

| Gemini SDK          | `@google/genai`              |

| Build Tool          | Vite                         |

| Configuration       | dotenv                       |



\---



\## Project Structure



```text

privacy-browser-agent/

│

├── src/

│   ├── ai.js

│   └── vision.js

│

├── public/

│   └── onnxruntime/

│

├── server/

│   └── server.js

│

├── dist/

│   ├── ai.mjs

│   ├── vision.mjs

│   └── assets/

│

├── content.js

├── popup.html

├── popup.js

├── manifest.json

├── test.html

├── package.json

├── package-lock.json

├── vite.config.js

├── .gitignore

└── .env

```



> `.env` is intentionally excluded from GitHub because it contains the Gemini API key.



\---



\## Running the Project



\### 1. Clone the Repository



```bash

git clone https://github.com/adhi1711/privacy-browser-agent.git

cd privacy-browser-agent

```



\### 2. Install Dependencies



```bash

npm install

```



On Windows PowerShell, use:



```powershell

npm.cmd install

```



\### 3. Add Your Gemini API Key



Create a `.env` file in the project root:



```env

GEMINI\_API\_KEY=YOUR\_API\_KEY

```



Do not commit this file to GitHub.



\### 4. Build the Extension



```bash

npm run build

```



On Windows PowerShell:



```powershell

npm.cmd run build

```



\### 5. Start the Backend



```bash

node server/server.js

```



The backend runs on:



```text

http://localhost:3000

```



\### 6. Load the Extension in Chrome



1\. Open Chrome.

2\. Go to `chrome://extensions/`.

3\. Enable \*\*Developer mode\*\*.

4\. Click \*\*Load unpacked\*\*.

5\. Select the `privacy-browser-agent` project folder.



\---



\## Demo



The repository includes a controlled demonstration webpage:



```text

test.html

```



The demo contains synthetic information such as:



\* Name

\* Email

\* Phone number

\* Location

\* Product information

\* Buttons and links



\### Demo Flow



```text

Open test.html

&#x20;     │

&#x20;     ▼

Open the extension

&#x20;     │

&#x20;     ▼

Click "ANALYZE PAGE"

&#x20;     │

&#x20;     ▼

Extract webpage content locally

&#x20;     │

&#x20;     ▼

Run local NER

&#x20;     │

&#x20;     ▼

Detect sensitive information

&#x20;     │

&#x20;     ▼

Create sanitized context

&#x20;     │

&#x20;     ▼

Send sanitized context to backend

&#x20;     │

&#x20;     ▼

Gemini reasons over sanitized context

&#x20;     │

&#x20;     ▼

Receive structured action

&#x20;     │

&#x20;     ▼

Execute action on the original DOM

```



\---



\## Prototype Performance



During one prototype run, we observed approximately:



| Stage              |    Time |

| ------------------ | ------: |

| Local NER          | \~1.42 s |

| Local Sanitization |   \~1 ms |

| Cloud Reasoning    | \~2.06 s |

| End-to-End         | \~3.48 s |



These are prototype measurements and may vary depending on hardware, browser state, model loading, and network conditions.



\---



\## What Is Working



The current prototype demonstrates:



\* Local webpage extraction

\* Local NER-based sensitive information detection

\* Local sanitization

\* Sanitized context sent to cloud AI

\* Structured AI responses

\* Browser action execution

\* Original DOM preservation

\* Local screenshot capture

\* Experimental local vision inference

\* Monitoring and dashboard interface



\---



\## Current Limitations



This is a \*\*hackathon prototype\*\*, not a production-ready browser agent.



\### Sensitive Information Detection



The current privacy layer mainly relies on NER. It may not detect every possible type of sensitive information.



\### Vision



The YOLOS-Tiny vision component is experimental and is not currently responsible for browser action decisions.



\### Cloud Reasoning



The reasoning stage currently depends on a cloud AI service.



\### Browser Actions



The current prototype supports a limited set of actions:



```text

NONE

CLICK

SCROLL

TYPE

```



\### Demo Environment



The included webpage is a controlled test page created specifically for demonstrating the system.



\---



\## Future Improvements



Potential future improvements include:



\* More comprehensive local PII detection

\* OCR-based privacy detection

\* DOM + vision fusion

\* Improved webpage visual understanding

\* More browser actions

\* Local multimodal models

\* Better confidence handling

\* Offline reasoning

\* Improved latency and resource usage

\* Enterprise browser-agent deployment



\---



\## Hackathon



This project was developed as a prototype for the \*\*Smart India Hackathon (SIH)\*\* problem statement:



> \*\*On-device Visual Perception for Light-weight Browser Agents\*\*



The project explores how lightweight on-device AI can provide a privacy layer for browser agents while still allowing cloud AI to perform complex reasoning.



\---



\## Core Idea



The project can be summarized as:



> \*\*Perceive privately → Reason remotely → Act locally.\*\*



Or, in simpler terms:



> \*\*We don't stop browser agents from using AI. We stop cloud AI from seeing information it doesn't need.\*\*



\---



\## Team



Built as a hackathon project focused on:



\*\*Privacy-Preserving AI + Browser Automation + On-Device AI\*\*



\---



\## License



This project is currently intended for educational and hackathon purposes.



