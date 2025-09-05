# app.py
from pathlib import Path
import os
from typing import Any, Dict

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI

# Load .env that sits next to this file
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError(f"OPENAI_API_KEY not found. Check {ENV_PATH}")

client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root() -> Dict[str, Any]:
    # Simple health check
    return {"message": "Backend is running"}

# LOCAL echo to verify POST + JSON wiring without touching OpenAI
@app.post("/paraphrase/test")
async def paraphrase_test(request: Request) -> Dict[str, Any]:
    data = await request.json()
    text = (data.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    return {"paraphrased": f"{text} (ok)"}

@app.post("/paraphrase")
async def paraphrase(request: Request) -> Dict[str, Any]:
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    text = (data.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Paraphrase this text clearly and concisely."},
                {"role": "user", "content": text},
            ],
        )
        content = resp.choices[0].message.content  # correct for openai>=1.x
        return {"paraphrased": content}
    except Exception as e:
        import traceback
        print("OpenAI API error:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"OpenAI error: {e}")
