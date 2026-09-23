#!/usr/bin/env python3
"""
ADK Gemini CAPTCHA Resolver - Backend Service
Powered by Google Agent Development Kit (ADK) & Gemini Vision
"""

import os
import sys
import json
import base64
import time
import logging
from aiohttp import web

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("captcha_resolver")

# Environment & GCP configuration
PROJECT_ID = os.environ.get("PROJECT_ID", "extended-atrium-508907-b6")
LOCATION = os.environ.get("LOCATION", "us-central1")
MODEL_NAME = os.environ.get("MODEL_NAME", "gemini-2.5-flash")
PORT = int(os.environ.get("PORT", "8080"))

# Initialize Google GenAI client (ADK foundation)
client = None
try:
    from google import genai
    from google.genai import types
    logger.info("Initializing Google GenAI Vertex client (Project: %s, Location: %s)...", PROJECT_ID, LOCATION)
    client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)
    logger.info("Google GenAI client initialized successfully with model %s", MODEL_NAME)
except Exception as e:
    logger.error("Failed to initialize Google GenAI client: %s", e)

SYSTEM_PROMPT = """
You are an expert automated CAPTCHA solver engine powered by Google Agent Development Kit (ADK) and Gemini Vision.
Analyze the provided CAPTCHA image with extreme precision and solve it.

Tasks:
1. Determine the CAPTCHA type:
   - "alphanumeric": distorted characters, letters and/or digits with noise, lines, or wave warps.
   - "math": arithmetic problem (e.g., '14 + 7', '8 x 3', '9 - 5 = ?').
   - "grid_selection": grid of tiles asking to identify specific objects (e.g. 'select traffic lights').
   - "word": clear dictionary word or phrase.
   - "other": puzzle or visual verification.

2. Solve the challenge:
   - For alphanumeric: Extract the exact characters preserving case if distinguishable. Ignore background noise, lines, grids, and dots.
   - For math: Calculate the correct arithmetic answer and provide the final number (e.g. if the image shows '12 + 8', the solution is '20').
   - For grid selection: List the matching tile numbers (e.g. 'Tiles 1, 4, 7') and the object detected.
   - For word: Provide the word.

3. Output ONLY a valid JSON object strictly matching this schema:
{
  "solution": "<the exact answer/characters/number to enter>",
  "captcha_type": "<alphanumeric | math | grid_selection | word | other>",
  "confidence": "<high | medium | low>",
  "explanation": "<brief 1-2 sentence breakdown of characters/math solved and how noise was filtered>"
}
"""

async def handle_health(request):
    """Health check endpoint for GCP Load Balancer and Cloud Run."""
    return web.json_response({
        "status": "healthy",
        "service": "adk-captcha-resolver",
        "model": MODEL_NAME,
        "project": PROJECT_ID,
        "location": LOCATION,
        "timestamp": time.time()
    })

async def handle_info(request):
    """Returns runtime metadata and ADK configuration."""
    return web.json_response({
        "status": "ready",
        "version": "1.0.0",
        "framework": "Google ADK / GenAI SDK",
        "model": MODEL_NAME,
        "project": PROJECT_ID,
        "location": LOCATION,
        "load_balancer_compatible": True
    })

async def handle_samples(request):
    """Return available sample CAPTCHA images bundled in the project resources."""
    samples = [
        {
            "id": "alphanumeric",
            "title": "Alphanumeric Code",
            "type": "alphanumeric",
            "description": "Distorted characters 'K8N49P' with strike-through lines & noise",
            "url": "/static/samples/sample_alphanumeric.jpg",
            "expected": "K8N49P"
        },
        {
            "id": "math",
            "title": "Math Arithmetic Challenge",
            "type": "math",
            "description": "Math problem '24 + 17 = ?' on textured paper with scratches",
            "url": "/static/samples/sample_math.jpg",
            "expected": "41"
        },
        {
            "id": "grid",
            "title": "3x3 Object Grid Selection",
            "type": "grid_selection",
            "description": "Photo verification: 'Select all squares with traffic lights'",
            "url": "/static/samples/sample_grid.jpg",
            "expected": "Tiles 2, 6, 7"
        },
        {
            "id": "word",
            "title": "Warped Word Puzzle",
            "type": "word",
            "description": "Distorted dictionary word 'overlook' with wavy ripple lines",
            "url": "/static/samples/sample_word.jpg",
            "expected": "overlook"
        },
        {
            "id": "wavy",
            "title": "Colorful Wavy Distorted",
            "type": "alphanumeric",
            "description": "High-contrast distorted text 'R9X2B5' with swirl interference",
            "url": "/static/samples/sample_wavy.jpg",
            "expected": "R9X2B5"
        }
    ]
    return web.json_response({"samples": samples, "count": len(samples)})

async def handle_solve(request):
    """Main CAPTCHA resolution endpoint."""
    start_time = time.time()
    try:
        data = await request.json()
        image_data = data.get("image")
        sample_id = data.get("sample_id")

        # Fallback to load bundled project resource if sample_id provided
        if not image_data and sample_id:
            sample_file_map = {
                "alphanumeric": "sample_alphanumeric.jpg",
                "math": "sample_math.jpg",
                "grid": "sample_grid.jpg",
                "word": "sample_word.jpg",
                "wavy": "sample_wavy.jpg"
            }
            if sample_id in sample_file_map:
                filename = sample_file_map[sample_id]
                sample_path = os.path.join(os.path.dirname(__file__), "static", "samples", filename)
                if os.path.exists(sample_path):
                    with open(sample_path, "rb") as f:
                        raw_bytes = f.read()
                        b64 = base64.b64encode(raw_bytes).decode("utf-8")
                        image_data = f"data:image/jpeg;base64,{b64}"

        if not image_data:
            return web.json_response({"error": "No image or sample_id provided"}, status=400)

        # Parse base64 data URL (e.g., data:image/png;base64,iVBOR...)
        mime_type = "image/png"
        if "," in image_data:
            header, base64_payload = image_data.split(",", 1)
            if "image/jpeg" in header or "image/jpg" in header:
                mime_type = "image/jpeg"
            elif "image/webp" in header:
                mime_type = "image/webp"
            elif "image/gif" in header:
                mime_type = "image/gif"
        else:
            base64_payload = image_data

        try:
            image_bytes = base64.b64decode(base64_payload)
        except Exception as e:
            return web.json_response({"error": f"Invalid base64 payload: {str(e)}"}, status=400)

        if not client:
            return web.json_response({
                "error": "Google GenAI ADK client not available on this host"
            }, status=503)

        # Build multimodal prompt with ADK GenAI types
        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        prompt_text = "Please solve this CAPTCHA image accurately. Return valid JSON."

        logger.info("Sending CAPTCHA image (%d bytes, %s) to %s...", len(image_bytes), mime_type, MODEL_NAME)

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[image_part, prompt_text],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.1
            )
        )

        raw_text = response.text.strip()
        logger.info("Gemini raw response: %s", raw_text)

        # Parse structured JSON
        try:
            result = json.loads(raw_text)
        except Exception:
            # Fallback if markdown fence was included
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
            result = json.loads(raw_text)

        elapsed_ms = int((time.time() - start_time) * 1000)
        result["latency_ms"] = elapsed_ms
        result["model"] = MODEL_NAME
        result["success"] = True

        return web.json_response(result)

    except Exception as e:
        logger.exception("Error solving CAPTCHA: %s", e)
        elapsed_ms = int((time.time() - start_time) * 1000)
        return web.json_response({
            "success": False,
            "error": str(e),
            "latency_ms": elapsed_ms
        }, status=500)

async def handle_index(request):
    """Serve the single-page frontend application."""
    index_path = os.path.join(os.path.dirname(__file__), "static", "index.html")
    return web.FileResponse(index_path)

def create_app():
    app = web.Application()
    
    # API endpoints
    app.router.add_get("/", handle_index)
    app.router.add_get("/health", handle_health)
    app.router.add_get("/api/health", handle_health)
    app.router.add_get("/api/info", handle_info)
    app.router.add_get("/api/samples", handle_samples)
    app.router.add_post("/api/solve", handle_solve)

    # Static assets
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    app.router.add_static("/static/", path=static_dir, name="static")

    return app

if __name__ == "__main__":
    app = create_app()
    logger.info("Starting ADK CAPTCHA Resolver on http://0.0.0.0:%d", PORT)
    web.run_app(app, host="0.0.0.0", port=PORT)
