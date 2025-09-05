# app.py
from pathlib import Path
import os
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import dotenv_values
from openai import OpenAI

# -----------------------------
# Load API key directly from .env
# (robust on Windows & with reload)
# -----------------------------
ENV_PATH = Path(__file__).resolve().parent / ".env"
CONFIG = dotenv_values(ENV_PATH)
OPENAI_API_KEY = (CONFIG.get("OPENAI_API_KEY") or "").strip()

if not OPENAI_API_KEY or not OPENAI_API_KEY.startswith("sk-"):
    raise RuntimeError(
        f"OPENAI_API_KEY missing/malformed in {ENV_PATH}. "
        "Add a line like: OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx"
    )

client = OpenAI(api_key=OPENAI_API_KEY)

# -----------------------------
# FastAPI app
# -----------------------------
app = FastAPI(title="100GPT Server", version="v1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # loosen for development; tighten in prod
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root() -> Dict[str, Any]:
    return {"message": "Backend is running"}

# ---------- Helpful health/debug (optional but recommended) ----------
@app.get("/health/openai")
def health_openai():
    try:
        client.models.list()  # minimal auth/permission check
        return {"openai_ok": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={"openai_ok": False, "error": str(e)})

@app.get("/debug/key")
def debug_key():
    tail = OPENAI_API_KEY[-6:] if OPENAI_API_KEY else "NONE"
    return {"present": bool(OPENAI_API_KEY), "length": len(OPENAI_API_KEY), "tail": tail}

# ---------- Request model (makes Swagger show a body editor) ----------
class ParaphraseRequest(BaseModel):
    text: str = Field(..., example="Rewrite this sentence more concisely.")

# ---------- Local echo (no OpenAI) ----------
@app.post("/paraphrase/test")
def paraphrase_test(payload: ParaphraseRequest) -> Dict[str, Any]:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    return {"paraphrased": f"{text} (ok)"}

# ---------- Real paraphrase (OpenAI) ----------
@app.post("/paraphrase")
def paraphrase(payload: ParaphraseRequest) -> Dict[str, Any]:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Paraphrase this text clearly and concisely."},
                {"role": "user", "content": text},
            ],
            timeout=30,
        )
        content = resp.choices[0].message.content  # openai>=1.x
        return {"paraphrased": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {e}")

# ---------- Optional: run directly (handy on Windows) ----------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8001, reload=False, log_level="info")
