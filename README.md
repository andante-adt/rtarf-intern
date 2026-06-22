# RTARF-SOC — Alert Triage Platform

AI-assisted SOC alert triage platform: FastAPI backend (auth, alert analysis, active response, audit log) + React/Vite/TypeScript frontend.

## Setup

### 1. Backend

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

Required variables:

- `JWT_SECRET_KEY` — long random string used to sign login tokens
- `SOC_USERNAME` / `SOC_PASSWORD` — login credentials for the SOC dashboard
- `TELEGRAM_TOKEN` / `TELEGRAM_CHAT_ID` — optional, only needed for Telegram alert notifications (`telegram_sender.py`)

Run the API:

```bash
uvicorn main:app --reload
```

The SQLite database (`rtarf_soc.db`) and its tables are created automatically on first run — no manual migration needed.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Default login is whatever you set as `SOC_USERNAME` / `SOC_PASSWORD` in `.env`.

## Notes

- `MOCK_ALERTS` (`frontend/src/mockAlerts.ts`) currently stands in for real alert ingestion — there is no live feed yet.
- `load_playbook.py` ingests a playbook PDF into a local ChromaDB store via Ollama embeddings (`nomic-embed-text`). It currently points at a hardcoded local file path — update `PDF_PATH` before running it.
- Active response actions (block IP / isolate host) are currently stubs in `main.py` and do not call a real firewall/EDR API yet.
