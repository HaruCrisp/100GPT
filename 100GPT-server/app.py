# app.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os

# Load API key from environment
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow extension to connect
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/paraphrase")
async def paraphrase(request: Request):
    data = await request.json()
    text = data.get("text", "")
    if not text.strip():
        return {"error": "No text provided"}

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Paraphrase this text clearly and concisely."},
            {"role": "user", "content": text}
        ]
    )

    return {"paraphrased": resp.choices[0].message["content"]}
