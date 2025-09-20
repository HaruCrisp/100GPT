from pathlib import Path
import os
import re
import io
import base64
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import dotenv_values

# OCR deps
from PIL import Image
import pytesseract

# Gemini SDK
import google.generativeai as genai

# -----------------------------
# Load Gemini API key from .env
# -----------------------------
ENV_PATH = Path(__file__).resolve().parent / ".env"
CONFIG = dotenv_values(ENV_PATH)
GEMINI_API_KEY = (CONFIG.get("GEMINI_API_KEY") or "").strip()

if not GEMINI_API_KEY:
    raise RuntimeError(
        f"GEMINI_API_KEY missing in {ENV_PATH}. "
        "Add a line like: GEMINI_API_KEY=your_api_key_here"
    )

genai.configure(api_key=GEMINI_API_KEY)

# -----------------------------
# Tesseract (Windows default path)
# -----------------------------
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# -----------------------------
# FastAPI app
# -----------------------------
app = FastAPI(title="100GPT Server", version="v2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # loosen for development; tighten in prod
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root() -> Dict[str, Any]:
    return {"message": "Backend is running"}

@app.get("/health/gemini")
def health_gemini():
    try:
        models = genai.list_models()
        return {"gemini_ok": True, "models_found": len(list(models))}
    except Exception as e:
        return JSONResponse(status_code=500, content={"gemini_ok": False, "error": str(e)})

@app.get("/debug/key")
def debug_key():
    tail = GEMINI_API_KEY[-6:] if GEMINI_API_KEY else "NONE"
    return {"present": bool(GEMINI_API_KEY), "length": len(GEMINI_API_KEY), "tail": tail}

# ---------- Schemas ----------
class ParaphraseRequest(BaseModel):
    text: str = Field(..., example="Rewrite this sentence more concisely.")

# ---------- Utilities ----------
def _tiny_local_paraphrase(s: str) -> str:
    rules = [
        (r"\butilize\b", "use"),
        (r"\bleverage\b", "use"),
        (r"\bin order to\b", "to"),
        (r"\bat this point in time\b", "now"),
        (r"\bdue to the fact that\b", "because"),
    ]
    out = s.strip()
    for pat, rep in rules:
        out = re.sub(pat, rep, out, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", out).strip()

def _call_model(system_prompt: str, user_text: str) -> Dict[str, Any]:
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        resp = model.generate_content([system_prompt, user_text])
        return {"ok": True, "content": resp.text, "fallback": False}
    except Exception as e:
        return {"ok": True, "content": _tiny_local_paraphrase(user_text),
                "fallback": True, "note": f"Gemini error: {e}"}

def _open_image_from_bytes(raw: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(raw))
    return img.convert("RGB")

def _ocr_image(img: Image.Image) -> str:
    text = pytesseract.image_to_string(img)
    text = re.sub(r"\s+\n", "\n", text).strip()
    return text

# ---------- Local echo ----------
@app.post("/paraphrase/test")
def paraphrase_test(payload: ParaphraseRequest) -> Dict[str, Any]:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    return {"paraphrased": f"{text} (ok)"}

# ---------- Real paraphrase ----------
@app.post("/paraphrase")
def paraphrase(payload: ParaphraseRequest) -> Dict[str, Any]:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    r = _call_model("Paraphrase this text clearly and concisely.", text)
    return {"paraphrased": r["content"], "fallback": r.get("fallback", False), "note": r.get("note")}

# ---------- Humanize ----------
@app.post("/humanize")
def humanize(payload: ParaphraseRequest) -> Dict[str, Any]:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    system_prompt = (
        "Humanize the text: keep the original meaning, reduce formality, "
        "remove jargon, use natural, conversational English, and vary sentence length. "
        "Preserve facts, names, and numbers. Do not add content."
    )
    r = _call_model(system_prompt, text)
    return {"humanized": r["content"], "fallback": r.get("fallback", False), "note": r.get("note")}

# ---------- OCR endpoints ----------
@app.post("/ocr")
async def ocr(file: UploadFile = File(...)) -> Dict[str, Any]:
    if file.content_type not in {"image/png", "image/jpeg"}:
        raise HTTPException(status_code=415, detail="Only PNG or JPEG images are supported")
    try:
        raw = await file.read()
        img = _open_image_from_bytes(raw)
        text = _ocr_image(img)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR error: {e}")

class ImageB64(BaseModel):
    image_b64: str

@app.post("/ocr_b64")
def ocr_b64(payload: ImageB64) -> Dict[str, Any]:
    try:
        data = payload.image_b64
        if "," in data:
            data = data.split(",", 1)[1]
        raw = base64.b64decode(data)
        img = _open_image_from_bytes(raw)
        text = _ocr_image(img)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR error: {e}")

@app.post("/ocr_pipeline")
async def ocr_pipeline(
    mode: str = Form(...),
    file: Optional[UploadFile] = File(default=None),
    image_b64: Optional[str] = Form(default=None),
) -> Dict[str, Any]:
    mode = (mode or "").lower().strip()
    if mode not in {"paraphrase", "humanize"}:
        raise HTTPException(status_code=400, detail="mode must be 'paraphrase' or 'humanize'" )

    try:
        if file is not None:
            if file.content_type not in {"image/png", "image/jpeg"}:
                raise HTTPException(status_code=415, detail="Only PNG or JPEG images are supported")
            raw = await file.read()
        elif image_b64:
            data = image_b64
            if "," in data:
                data = data.split(",", 1)[1]
            raw = base64.b64decode(data)
        else:
            raise HTTPException(status_code=400, detail="Provide image via 'file' or 'image_b64'")

        img = _open_image_from_bytes(raw)
        text = _ocr_image(img)

        if not text:
            return {"text": "", "ai": None, "fallback": False, "note": "No text detected"}

        if mode == "paraphrase":
            prompt = "Paraphrase this text clearly and concisely."
        else:
            prompt = (
                "Humanize the text: keep the original meaning, reduce formality, "
                "remove jargon, use natural, conversational English, and vary sentence length. "
                "Preserve facts, names, and numbers. Do not add content."
            )

        r = _call_model(prompt, text)
        return {"text": text, "ai": r["content"], "fallback": r.get("fallback", False), "note": r.get("note")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR pipeline error: {e}")

# ---------- Optional: run directly ----------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8001, reload=False, log_level="info")
