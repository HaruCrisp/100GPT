# 100GPT

**100GPT** is an AI-powered Chrome Extension + FastAPI backend that can:
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
