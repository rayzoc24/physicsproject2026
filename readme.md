# Spacetime Simulator

Educational full-stack web app that visualizes spacetime curvature from different astronomical objects.

## Tech Stack

- Frontend: React + Vite + Three.js + Axios
- Backend: Flask + NumPy

## Features

- `GET /simulate?object=<name>` backend endpoint for physics fields
- 3D curvature mesh displacement in Three.js
- Wireframe toggle
- Normalized height mapping for stable visualization
- Smooth lighting with recalculated vertex normals
- Educational descriptions for each object

## Simulated Objects

- Black Hole: steep inverse-radius gravitational well with an event horizon region
- Wormhole: dual-sheet embedding-like shape connected by a throat
- Solar System: superposition of Sun and planet wells
- Neutrino: sinusoidal wave packet with Gaussian envelope
- Nebula: layered procedural cloud-like density field

## Run Backend

```bash
cd backend
python -m pip install -r requirements.txt
python app.py
```

Backend runs on `http://127.0.0.1:5000`.

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://127.0.0.1:5173` and proxies `/simulate` to Flask.
