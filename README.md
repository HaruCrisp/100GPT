# 100GPT

**100GPT** is an AI-powered Chrome Extension + FastAPI backend that can:
<<<<<<< HEAD
- Paraphrase highlighted text on any webpage
- Capture screenshots → extract text (OCR) → paraphrase it with AI

## Project Structure
- **100GPT-extension/** → Chrome extension (Manifest v3, JS, HTML)
- **100GPT-server/** → FastAPI backend (Python)

## Run Backend
```bash
cd 100GPT-server
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
=======

- ✍️ **Paraphrase** highlighted text on any webpage  
- 🖼️ **Capture screenshots** → extract text (OCR) → paraphrase or humanize it with AI  
- 🤝 **Humanize** text to make it more natural, conversational, and reader-friendly

---

## 📂 Project Structure
## 100GPT/
## ├── 100GPT-extension/ # Chrome Extension (Manifest V3, JS, HTML, CSS)
## └── 100GPT-server/ # FastAPI backend (Python)

- **100GPT-extension/**  
  - Context menu actions for paraphrasing / humanizing text  
  - Screenshot-to-OCR capture workflow  
  - Popup UI for direct interaction  

- **100GPT-server/**  
  - FastAPI app with endpoints for paraphrasing, humanizing, and OCR pipeline  
  - Uses OpenAI API + Tesseract OCR  
  
---
>>>>>>> 371a92ec1b4044ec7647619ba53803cc073c840d
