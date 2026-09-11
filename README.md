\# Privacy Browser Agent



\### On-device Visual Perception for Lightweight Browser Agents



Privacy Browser Agent is a Chrome extension prototype that adds a \*\*local privacy layer to AI-powered browser automation\*\*.



Instead of sending an entire webpage directly to a cloud AI model, the extension first analyzes the webpage locally, detects sensitive information, and creates a sanitized version of the content.



Only the sanitized context is sent to the cloud AI for reasoning. The browser then executes the returned action locally on the original webpage.



\*\*Local AI protects → Cloud AI reasons → Browser executes\*\*



\---



\## Why We Built This



AI browser agents need access to webpage information to understand what is on a page and decide what action to take.



The problem is that webpages can also contain private information such as:



\* Names

\* Email addresses

\* Phone numbers

\* Locations

\* Organizations

\* Other personal information



Sending all of this information to a cloud AI model creates an unnecessary privacy risk.



Our approach is to put a \*\*privacy filter on the user's device before cloud processing\*\*.



\---



\## How It Works



The basic workflow is:



```text

Webpage

&#x20;  │

&#x20;  ▼

Local webpage extraction

&#x20;  │

&#x20;  ▼

Local AI / NER

&#x20;  │

&#x20;  ▼

Sensitive information detection

&#x20;  │

&#x20;  ▼

Sanitization

&#x20;  │

&#x20;  ▼

Sanitized webpage context

&#x20;  │

&#x20;  ▼

Cloud AI

&#x20;  │

&#x20;  ▼

Action returned

&#x20;  │

&#x20;  ▼

Original webpage

&#x20;  │

&#x20;  ▼

Browser action

```



The important part is that the \*\*original sensitive values stay on the device\*\*.



The cloud AI receives a sanitized representation instead of the raw private information.



\---



\## Privacy Approach



The extension keeps the original webpage DOM unchanged.



It creates a separate sanitized representation for cloud reasoning.



For example:



```text

Original:



Name: Adhithya Venkatesh

Email: adhithya@example.com

Phone: 9876543210

Location: Chennai

```



The cloud receives something similar to:



```text

Name: \[PERSON]

Email: \[EMAIL]

Phone: \[PHONE]

Location: \[LOCATION]

```



This allows the cloud AI to understand the structure of the webpage without needing the actual private values.



The original DOM is then used locally when an action needs to be performed.



\---



\## Local AI



Sensitive information detection runs locally inside the browser using \*\*Hugging Face Transformers.js\*\*.



The current prototype uses:



```text

Xenova/bert-base-NER

```



The model performs Named Entity Recognition (NER) and identifies entities that can be used by the privacy layer.



Running this step locally is important because the webpage is analyzed \*\*before\*\* its context is sent to the cloud.



\---



\## Cloud Reasoning



Once the webpage has been sanitized, the cleaned context is sent to our backend.



The backend uses \*\*Google Gemini\*\* to reason about the webpage and decide what action should be taken.



The current action types are:



```text

NONE

CLICK

SCROLL

TYPE

```



For example, Gemini can return:



```json

{

&#x20; "action": "CLICK",

&#x20; "target": "Add to Cart"

}

```



The extension then finds `"Add to Cart"` in the \*\*original DOM\*\* and performs the click locally.



\---



\## Experimental Vision Pipeline



The project also includes a local vision pipeline using:



\* YOLOS-Tiny

\* Transformers.js

\* ONNX Runtime

\* WebAssembly



The vision pipeline can capture a screenshot and run local object detection.



```text

Screenshot

&#x20;   ↓

Canvas

&#x20;   ↓

YOLOS-Tiny

&#x20;   ↓

Local detection

```



\### Current status



The vision component is currently \*\*experimental\*\*.



The main working prototype uses DOM/text extraction and local NER for privacy protection and browser actions.



The vision pipeline is included as a foundation for future work where visual information may not be available or reliable through the DOM alone.



\---



\## System Architecture



\### Traditional approach



```text

Webpage

&#x20;  ↓

Cloud AI

&#x20;  ↓

Browser Action

```



The cloud receives the webpage context directly.



\### Our approach



```text

Webpage

&#x20;  ↓

Local Privacy Layer

&#x20;  ↓

Sanitized Context

&#x20;  ↓

Cloud AI

&#x20;  ↓

Browser Action

```



The main idea is simple:



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

| API                 | Express.js                   |

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



\### 1. Clone the repository



```bash

git clone https://github.com/adhi1711/privacy-browser-agent.git

cd privacy-browser-agent

```



\### 2. Install dependencies



```bash

npm install

```



On Windows PowerShell, use this if necessary:



```powershell

npm.cmd install

```



\### 3. Add your Gemini API key



Create a `.env` file in the project root:



```env

GEMINI\_API\_KEY=YOUR\_API\_KEY

```



Do not commit this file.



\### 4. Build the extension



```bash

npm run build

```



If required on Windows:



```powershell

npm.cmd run build

```



\### 5. Start the backend



```bash

node server/server.js

```



The backend runs on:



```text

http://localhost:3000

```



\### 6. Load the extension in Chrome



1\. Open Chrome.

2\. Go to `chrome://extensions/`

3\. Enable \*\*Developer mode\*\*.

4\. Click \*\*Load unpacked\*\*.

5\. Select the `privacy-browser-agent` project folder.



\---



\## Demo



The project includes a controlled demo webpage in:



```text

test.html

```



The page contains synthetic information such as:



\* Name

\* Email

\* Phone number

\* Location

\* Product information

\* Buttons and links



\### Demo flow



```text

Open test.html

&#x20;     ↓

Open the extension

&#x20;     ↓

Click "ANALYZE PAGE"

&#x20;     ↓

Extract webpage content locally

&#x20;     ↓

Run local NER

&#x20;     ↓

Detect sensitive information

&#x20;     ↓

Create sanitized context

&#x20;     ↓

Send sanitized context to backend

&#x20;     ↓

Gemini reasons over the sanitized context

&#x20;     ↓

Receive an action

&#x20;     ↓

Execute the action on the original DOM

```



\---



\## Prototype Performance



During one prototype run, we observed approximately:



| Stage           |    Time |

| --------------- | ------: |

| Local NER       | \~1.42 s |

| Local redaction |   \~1 ms |

| Cloud reasoning | \~2.06 s |

| End-to-end      | \~3.48 s |



These numbers are prototype measurements and can vary depending on hardware, model loading, browser state, and network conditions.



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

\* Monitoring/dashboard interface



\---



\## Current Limitations



This is a hackathon prototype, not a production-ready browser agent.



\### Sensitive information detection



The current system mainly relies on NER, so it may not detect every possible type of sensitive information.



\### Vision



The YOLOS-Tiny vision component is experimental and is not currently responsible for browser action decisions.



\### Cloud reasoning



The reasoning stage currently depends on a cloud AI service.



\### Browser actions



The current prototype supports a limited set of actions:



```text

NONE

CLICK

SCROLL

TYPE

```



\### Demo environment



The included webpage is a controlled test page created specifically for demonstrating the system.



\---



\## Future Improvements



Some areas we would like to explore next:



\* Better local PII detection

\* OCR-based privacy detection

\* DOM + vision fusion

\* More reliable webpage visual understanding

\* More browser actions

\* Local multimodal models

\* Better confidence handling

\* Offline reasoning

\* Improved latency and resource usage

\* Enterprise browser-agent deployment



\---



\## Hackathon



This project was developed as a prototype for the \*\*Smart India Hackathon (SIH)\*\* problem statement:



\*\*On-device Visual Perception for Light-weight Browser Agents\*\*



The project focuses on exploring how lightweight on-device AI can provide a privacy layer for browser agents while still allowing cloud AI to perform complex reasoning.



\---



\## Core Idea



The project can be summarized in one line:



> \*\*Perceive privately → Reason remotely → Act locally.\*\*



Or, even simpler:



> \*\*We don't stop browser agents from using AI. We stop cloud AI from seeing information it doesn't need.\*\*



\---



\## Team



Built as a hackathon project focused on:



\*\*Privacy-Preserving AI + Browser Automation + On-Device AI\*\*



\---



\## License



This project is currently intended for educational and hackathon purposes.



