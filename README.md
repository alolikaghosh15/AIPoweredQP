# AI Powered Question Paper System

## Run in VS Code (2 terminals)
Requires Node.js 18+ and MongoDB running locally (or a MongoDB Atlas URI in `server/.env`).

**Terminal 1 – server**
```
cd server
npm install
npm run dev
```
**Terminal 2 – client**
```
cd client
npm install
npm run dev
```
Open the URL Vite prints (usually http://localhost:5173). API runs on http://localhost:5000.

`server/.env` is included for local use. Set `ANTHROPIC_API_KEY` there for real AI generation
(works with a placeholder generator without it). Never commit `.env` to GitHub (see `.gitignore`).
