# 🏛️ Mystic Vault: Interactive Team Puzzle

Mystic Vault is a high-stakes, multi-round technical challenge where teams must solve puzzles, navigate ciphers, and bypass AI security to unlock the final vault. This project is built with a **React (Vite) frontend** and a **FastAPI (Python) backend** utilizing Playwright for Gandalf AI integration.

---

## 🚀 Quick Start (Windows + Docker Desktop)

The easiest way to get the game running on Windows is using **Docker Desktop**. This ensures all browser automation dependencies (Playwright) are correctly configured without manual setup.

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running on your Windows machine.
- A terminal (PowerShell, CMD, or Windows Terminal).

### 2. Build the Game
Open your terminal in the `v1/react_version` folder and run:
```powershell
docker build -t mystic-vault:latest .
```

### 3. Run the Game
Launch the container with port mappings for both the UI and the API:
```powershell
docker run -it -p 5173:5173 -p 8000:8000 mystic-vault:latest
```

### 4. Play!
Once the container starts:
- **Frontend (The Game)**: Open [http://localhost:5173](http://localhost:5173) in your browser.
- **Backend (API)**: Runs at [http://localhost:8000](http://localhost:8000).

---

## 🛠️ Local Development (Manual Setup)

If you prefer to run the services manually (without Docker):

### Backend (FastAPI)
1. Navigate to the `backend/` folder.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   playwright install chromium --with-deps
   ```
4. Start the server:
   ```bash
   uvicorn main:app --port 8000
   ```

### Frontend (React + Vite)
1. Navigate to the root directory (`v1/react_version`).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```

---

## 🧩 Game Overview
- **Round 1**: Digital investigation and logic.
- **Round 2**: The Dark Maze Challenge (Coordination-based navigation).
- **Round 3**: The Watchman of the Gate (AI Social Engineering via Gandalf).
- **Final Reveal**: The Mystic Vault Unlock sequence.

---

## 📜 Credits
Built with React, Vite, FastAPI, and Playwright.
Custom 3D-styled CSS and interactive components designed for a premium competitive experience.
