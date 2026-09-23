# ADK Gemini CAPTCHA Resolver

An intelligent CAPTCHA analysis and resolution service powered by **Google Agent Development Kit (ADK)** and **Gemini Vision** (`gemini-2.5-flash`), featuring an interactive dashboard and REST API.

## Features

- **Multimodal CAPTCHA Analysis**: Resolves alphanumeric, math puzzles, grid selection, and word challenges using Gemini Vision.
- **RESTful API**: Fast asynchronous endpoints built with `aiohttp` for image ingestion and structured JSON output.
- **Interactive Web Interface**: Single-page dashboard built with Tailwind CSS and Lucide icons to upload, test, and inspect CAPTCHA resolutions in real-time.
- **Production-Ready Containerization**: Dockerfile configured for deployment to **Google Cloud Run** and container runtimes.
- **Health & Info Endpoints**: `/health` and `/api/info` endpoints for load balancing, monitoring, and readiness checks.

## Architecture

- **Backend**: Python 3.11+, `aiohttp`, `google-genai` (Vertex AI SDK)
- **Frontend**: HTML5, Tailwind CSS, Lucide Icons, vanilla ES6 JS
- **Model**: `gemini-2.5-flash` via Vertex AI

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Web user interface |
| `GET` | `/health` / `/api/health` | Health check endpoint |
| `GET` | `/api/info` | Service metadata and model configuration |
| `POST` | `/api/solve` | Submit CAPTCHA image (base64) for resolution |

### Example Request (`/api/solve`)

```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### Example Response

```json
{
  "solution": "7X8K2",
  "captcha_type": "alphanumeric",
  "confidence": "high",
  "explanation": "Extracted 5 distorted alphanumeric characters filtering out wave noise and background dots.",
  "latency_ms": 320,
  "model": "gemini-2.5-flash",
  "success": true
}
```

## Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/noam2030/captcha-resolver.git
   cd captcha-resolver
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables and run:
   ```bash
   export PROJECT_ID="<your-gcp-project-id>"
   export LOCATION="us-central1"
   export MODEL_NAME="gemini-2.5-flash"
   export PORT=8080

   python app.py
   ```

## Deploying to Google Cloud Run

Deploy directly from source using the Google Cloud SDK:

```bash
gcloud run deploy captcha-resolver \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars PROJECT_ID=<your-gcp-project-id>,LOCATION=us-central1,MODEL_NAME=gemini-2.5-flash
```
