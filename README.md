\# Privacy Browser Agent



> \*\*On-device Visual Perception for Lightweight Browser Agents\*\*



A privacy-preserving browser agent that performs sensitive-information detection locally before sending webpage context to cloud AI.



The system follows a simple principle:



\*\*Local AI protects → Cloud AI reasons → Browser executes\*\*



\---



\## 📌 Overview



Modern browser agents can use AI to understand webpages and perform actions such as clicking buttons, scrolling, and interacting with web content.



However, sending raw webpage content directly to a cloud AI model can expose sensitive information such as:



\* Names

\* Email addresses

\* Phone numbers

\* Locations

\* Organizations

\* Other personally identifiable information (PII)



\*\*Privacy Browser Agent\*\* introduces a local privacy layer between the webpage and cloud AI.



Sensitive information is detected and sanitized \*\*on the user's device\*\* before any webpage context is sent to the cloud.



The cloud AI receives only the sanitized representation and returns a structured browser action.



\---



\## 🎯 Problem Statement



Browser agents increasingly rely on webpage and visual context to perform tasks.



Traditional architectures may send webpage information directly to remote AI systems, creating privacy risks when pages contain personal or confidential information.



The goal of this project is to build a lightweight browser agent that:



1\. Processes webpage information locally.

2\. Detects sensitive information using lightweight AI.

3\. Prevents sensitive information from leaving the device.

4\. Sends only sanitized context to cloud AI.

5\. Uses cloud AI for higher-level reasoning.

6\. Executes the returned action locally in the browser.



\---



\## 💡 Proposed Solution



The extension separates \*\*privacy-sensitive perception\*\* from \*\*cloud-based reasoning\*\*.



\### Workflow



```text

&#x20;               WEBPAGE

&#x20;                  │

&#x20;                  ▼

&#x20;         ┌─────────────────┐

&#x20;         │ Local Extraction│

&#x20;         └────────┬────────┘

&#x20;                  │

&#x20;                  ▼

&#x20;         ┌─────────────────┐

&#x20;         │   Local AI/N​​ER  │

&#x20;         │ PII Detection   │

&#x20;         └────────┬────────┘

&#x20;                  │

&#x20;                  ▼

&#x20;         ┌─────────────────┐

&#x20;         │ Privacy Filter  │

&#x20;         │ \& Sanitization  │

&#x20;         └────────┬────────┘

&#x20;                  │

&#x20;            Sanitized Data

&#x20;                  │

&#x20;                  ▼

&#x20;         ┌─────────────────┐

&#x20;         │    Cloud AI     │

&#x20;         │    Reasoning    │

&#x20;         └────────┬────────┘

&#x20;                  │

&#x20;            Action JSON

&#x20;                  │

&#x20;                  ▼

&#x20;         ┌─────────────────┐

&#x20;         │ Browser Action  │

&#x20;         └────────┬────────┘

&#x20;                  │

&#x20;                  ▼

&#x20;           Original DOM

```



The important security boundary is:



> \*\*Raw sensitive information is processed locally and is not included in the cloud request.\*\*



\---



\## 🔐 Privacy Architecture



The system maintains two representations of the webpage:



\### Original DOM



The original webpage remains unchanged and is used locally for browser interaction.



\### Sanitized Context



A separate representation is created for cloud reasoning.



Sensitive information is replaced with privacy-safe placeholders before the context is sent to the cloud.



For example:



```text

Original:

Name: \[private name]

Email: \[private email]

Phone: \[private phone]



Sanitized:

Name: \[PERSON]

Email: \[EMAIL]

Phone: \[PHONE]

```



The cloud AI therefore reasons about the structure and available actions without receiving the original sensitive values.



\---



\## 🤖 Local AI



The project uses \*\*Hugging Face Transformers.js\*\* to run AI inference locally inside the browser environment.



\### Model



```text

Xenova/bert-base-NER

```



The model performs token classification / Named Entity Recognition (NER).



Detected entities are grouped and used by the local privacy layer to create sanitized webpage context.



\### Why local AI?



Running the privacy detection locally provides an important security boundary:



```text

Webpage

&#x20;  ↓

Local AI

&#x20;  ↓

Privacy filtering

&#x20;  ↓

Sanitized context

&#x20;  ↓

Cloud AI

```



The cloud model never needs access to the raw sensitive values.



\---



\## ☁️ Cloud AI



After sanitization, the cleaned webpage context is sent to the backend.



The backend uses:



```text

Google Gemini

```



The cloud model analyzes the sanitized context and determines an appropriate browser action.



Supported actions include:



```text

NONE

CLICK

SCROLL

TYPE

```



Example response:



```json

{

&#x20; "action": "CLICK",

&#x20; "target": "Add to Cart"

}

```



The browser extension receives this structured response and performs the action locally.



\---



\## 🌐 Browser Action Execution



The action returned by the cloud model is matched against the \*\*original webpage DOM\*\*.



This is important because the live webpage is not modified by the privacy filter.



For example:



```text

Cloud AI:

{

&#x20; "action": "CLICK",

&#x20; "target": "Add to Cart"

}



&#x20;            ↓



Original DOM

&#x20;            ↓



Find "Add to Cart"

&#x20;            ↓



Execute click locally

```



This allows the browser to interact with the original webpage while keeping sensitive information out of the cloud request.



\---



\## 👁️ Experimental Visual Perception



The project also includes an experimental local vision pipeline using:



```text

YOLOS-Tiny

ONNX Runtime

WebAssembly

Transformers.js

```



The pipeline can capture a webpage screenshot and run local object detection.



Current architecture:



```text

Screenshot

&#x20;   ↓

Canvas

&#x20;   ↓

YOLOS-Tiny

&#x20;   ↓

Local object detection

```



\### Current status



The visual perception component is \*\*experimental\*\*.



The main working prototype currently relies on DOM/text extraction and local NER for privacy protection and browser action decisions.



The vision component is included as a foundation for future webpage visual understanding where important information may not be reliably represented in the DOM.



\---



\## 🧩 Technology Stack



| Component           | Technology                   |

| ------------------- | ---------------------------- |

| Browser Extension   | Chrome Manifest V3           |

| Frontend            | HTML, CSS, JavaScript        |

| Browser Interaction | JavaScript DOM APIs          |

| Local AI            | Hugging Face Transformers.js |

| Local NER Model     | Xenova/BERT-base-NER         |

| AI Runtime          | ONNX Runtime / WebAssembly   |

| Vision Model        | YOLOS-Tiny                   |

| Backend             | Node.js                      |

| API Framework       | Express.js                   |

| Cloud AI            | Google Gemini                |

| API SDK             | `@google/genai`              |

| Build Tool          | Vite                         |

| Configuration       | dotenv                       |

| Development         | VS Code / PowerShell         |



\---



\## 📁 Project Structure



```text

privacy-browser-agent/

│

├── src/

│   ├── ai.js

│   └── vision.js

│

├── dist/

│   ├── ai.mjs

│   ├── vision.mjs

│   └── assets/

│

├── public/

│   └── onnxruntime/

│

├── server/

│   └── server.js

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



> `.env` contains the Gemini API key and should \*\*never be committed to GitHub\*\*.



\---



\## 🚀 Installation



\### 1. Clone the repository



```bash

git clone https://github.com/adhi1711/privacy-browser-agent.git

cd privacy-browser-agent

```



\### 2. Install dependencies



```bash

npm install

```



If PowerShell blocks the npm command on Windows, use:



```powershell

npm.cmd install

```



\### 3. Configure the API key



Create a `.env` file:



```env

GEMINI\_API\_KEY=YOUR\_API\_KEY

```



Do not commit this file.



\---



\## 🔨 Build the Extension



Run:



```bash

npm run build

```



On Windows PowerShell, if necessary:



```powershell

npm.cmd run build

```



The compiled files are generated in the `dist/` directory.



\---



\## 🌐 Load the Extension in Chrome



1\. Open Chrome.

2\. Go to:



```text

chrome://extensions/

```



3\. Enable \*\*Developer mode\*\*.

4\. Select \*\*Load unpacked\*\*.

5\. Choose the project folder:



```text

privacy-browser-agent

```



6\. The \*\*Privacy Browser Agent\*\* extension should appear.



\---



\## 🖥️ Start the Backend



Open a terminal inside the project directory and run:



```bash

node server/server.js

```



The backend runs at:



```text

http://localhost:3000

```



You should see:



```text

Server running on http://localhost:3000

```



\---



\## 🧪 Demo



The repository contains a controlled demonstration webpage:



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



\### Demo Flow



```text

1\. Open test.html

&#x20;       ↓

2\. Open Privacy Browser Agent

&#x20;       ↓

3\. Click ANALYZE PAGE

&#x20;       ↓

4\. Extract webpage content locally

&#x20;       ↓

5\. Run local NER

&#x20;       ↓

6\. Detect sensitive information

&#x20;       ↓

7\. Create sanitized context

&#x20;       ↓

8\. Send sanitized context to backend

&#x20;       ↓

9\. Gemini analyzes the sanitized context

&#x20;       ↓

10\. Receive structured action

&#x20;       ↓

11\. Execute action on original DOM

```



\---



\## 📊 Prototype Performance



Example prototype run:



| Stage           | Approx. Time |

| --------------- | -----------: |

| Local NER       |      \~1.42 s |

| Local Redaction |        \~1 ms |

| Cloud Reasoning |      \~2.06 s |

| End-to-End      |      \~3.48 s |



These measurements are prototype observations and can vary depending on hardware, browser state, model loading, network conditions, and cloud response time.



\---



\## ✨ Key Features



\### 🔒 Local Privacy Protection



Sensitive information is detected before webpage context is sent to the cloud.



\### 🧠 Local AI



NER inference runs locally using Transformers.js.



\### ☁️ Cloud Reasoning



Sanitized context is sent to Gemini for higher-level reasoning.



\### 🖱️ Browser Automation



The extension can execute structured actions such as:



\* Click

\* Scroll

\* Type

\* None



\### 🖥️ Local Vision Pipeline



An experimental YOLOS-Tiny pipeline provides a foundation for local visual perception.



\### 📊 Monitoring Dashboard



The extension includes a dashboard for monitoring:



\* Local AI status

\* Privacy detection

\* Sanitization

\* Cloud reasoning

\* Browser actions

\* Pipeline information

\* Logs

\* Experimental visual perception



\---



\## 🌟 Innovation



Traditional browser-agent architecture:



```text

Webpage

&#x20;  ↓

Cloud AI

&#x20;  ↓

Browser Action

```



Potential problem:



```text

Sensitive webpage information

&#x20;         ↓

&#x20;      Cloud AI

```



Our architecture:



```text

Webpage

&#x20;  ↓

LOCAL PRIVACY FILTER

&#x20;  ↓

Sanitized Context

&#x20;  ↓

Cloud AI

&#x20;  ↓

Browser Action

```



The core innovation is the \*\*privacy boundary between perception and reasoning\*\*.



> \*\*We don't prevent the browser agent from using AI. We prevent the cloud AI from seeing what it doesn't need to see.\*\*



\---



\## 🎯 Use Cases



The architecture can be extended to privacy-sensitive browser automation scenarios such as:



\* Personal productivity assistants

\* Enterprise browser agents

\* Customer-support workflows

\* Financial dashboards

\* Healthcare portals

\* Internal company applications

\* Form assistance

\* Privacy-aware AI browsing



\---



\## ⚠️ Current Limitations



This is a working prototype and has several limitations.



\### 1. NER-based detection



The current privacy layer primarily relies on NER and therefore may not detect every possible type of sensitive information.



\### 2. Experimental visual perception



The YOLOS-Tiny vision pipeline is currently experimental and is not the primary mechanism for browser action decisions.



\### 3. Cloud dependency



The reasoning stage currently uses a cloud AI model.



\### 4. Prototype action set



The current action space is limited to:



```text

NONE

CLICK

SCROLL

TYPE

```



\### 5. Controlled demo environment



The included webpage is designed for demonstration and testing rather than production browser automation.



\---



\## 🔮 Future Scope



Potential improvements include:



\* More advanced local PII detection

\* OCR-based privacy detection

\* Improved visual webpage understanding

\* DOM + vision fusion

\* Local multimodal models

\* Better confidence-based privacy filtering

\* More browser actions

\* Offline cloud-reasoning alternatives

\* Stronger privacy guarantees

\* Enterprise deployment

\* Hardware-aware model selection

\* Improved latency and resource optimization



\---



\## 🏆 Hackathon Context



This project was developed as a prototype for the \*\*Smart India Hackathon (SIH)\*\* problem statement:



> \*\*On-device Visual Perception for Light-weight Browser Agents\*\*



The prototype focuses on demonstrating how local AI can act as a privacy layer between webpages and cloud-based browser-agent reasoning.



\---



\## 👥 Team



Developed as a hackathon project focused on:



\*\*Privacy-Preserving AI + Browser Automation + On-Device AI\*\*



\---



\## 📜 License



This project is currently provided for educational and hackathon purposes.



