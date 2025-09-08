# 100GPT

**100GPT** is an AI-powered Chrome Extension + FastAPI backend that can:

- ✍️ **Paraphrase** highlighted text on any webpage  
- 🖼️ **Capture screenshots** → extract text (OCR) → paraphrase or humanize it with AI  

---

## 📂 Project Structure
100GPT/
├── 100GPT-extension/ # Chrome Extension (Manifest V3, JS, HTML, CSS)
└── 100GPT-server/ # FastAPI backend (Python)

- **100GPT-extension/**  
  - Context menu actions for paraphrasing / humanizing text  
  - Screenshot-to-OCR capture workflow  
  - Popup UI for direct interaction  

- **100GPT-server/**  
  - FastAPI app with endpoints for paraphrasing, humanizing, and OCR pipeline  
  - Uses OpenAI API + Tesseract OCR  
  - `.env` file for secrets (ignored by Git; use `.env.example` for sharing)  

---