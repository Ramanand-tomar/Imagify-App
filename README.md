# Imagify AI — Intelligent Document & Image Suite

Imagify is a high-performance, industry-ready suite for processing documents (PDFs) and enhancing images using classical DIP (Digital Image Processing) and modern AI techniques.

## 🚀 Key Features

- **📄 PDF Tools:** Merge, Split, and Compress PDF documents.
- **🎨 Image Enhancement:** 
  - Classical: CLAHE, Bilateral Denoising, Sharpening, Edge Detection (Canny/Sobel).
  - Advanced: Wiener Filter Deblurring, Homomorphic Illumination Normalization.
  - AI-Powered: 2x/4x Super-Resolution, Low-light Enhancement, NLM Denoising.
- **🔍 Smart Scanner:** Camera-to-PDF pipeline with auto-cropping and OCR (Optical Character Recognition).
- **⚡ Async Processing:** Heavy tasks are handled in the background via Celery + Redis.

---

## 🛠️ Tech Stack

- **Backend:** FastAPI, SQLAlchemy (PostgreSQL), Celery, Redis.
- **Frontend:** React Native (Expo), React Native Paper, Lucide Icons.
- **Image Processing:** OpenCV, NumPy, Pillow, Tesseract OCR.
- **Infrastructure:** Render (API + Worker), ImageKit.io (Storage), Neon (Database), Upstash (Redis).

---

## 💻 Local Development Setup

### Backend
1. `cd backend`
2. Create virtual environment: `python -m venv venv`
3. Activate: `source venv/bin/activate` (or `venv\Scripts\activate` on Windows)
4. Install dependencies: `pip install -r requirements.txt`
5. Set up `.env` (refer to `.env.example`)
6. Run migrations: `alembic upgrade head`
7. Start server: `uvicorn app.main:app --reload`
8. Start worker (separate terminal): `celery -A app.core.celery_app worker --loglevel=info`

### Frontend
1. `cd frontend`
2. Install: `npm install`
3. Set up `.env` (refer to `.env.example`)
4. Start Expo: `npx expo start`

---

## 🌍 Render Deployment (8-Step Checklist)

1. **GitHub Fork:** Fork this repository and connect it to Render.
2. **Environment Group:** Create an Env Group `imagify-env` with secret keys from `.env.example`.
3. **Database:** Provision a **Neon.tech** Postgres instance and set `DATABASE_URL` (use `postgresql+asyncpg://`).
4. **Redis:** Provision an **Upstash** Redis instance and set `REDIS_URL`.
5. **Storage:** Sign up for **ImageKit.io**, create a `/imagify` folder, and set the keys.
6. **API Web Service:**
   - Name: `imagify-api`
   - Root Directory: `backend`
   - Build Command: `./build.sh`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
7. **Worker Background Service:**
   - Name: `imagify-worker`
   - Root Directory: `backend`
   - Build Command: `./build.sh`
   - Start Command: `celery -A app.core.celery_app worker --loglevel=info`
8. **UptimeRobot (Cold Start Fix):** Since Render free tier sleeps, set up an UptimeRobot monitor pointing to `https://your-api.onrender.com/health` to keep it awake.
