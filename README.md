# Confira

Confira is an AI-powered interview and hiring platform with a React/Vite client and FastAPI/Supabase backend.

## Backend setup

The FastAPI backend, SQL schema, RLS setup, and storage instructions are in [backend/README.md](backend/README.md). Copy the root `.env.example` to `.env` for the browser-safe Supabase URL and anon key; never expose the service-role key.

## Included

- Candidate and Interviewer/Company authentication
- Candidate dashboard
- Resume upload UI
- Interview scheduling and interview list
- Pre-interview system check
- Live interview candidate view
- Interviewer live monitoring dashboard
- Real-time malpractice/attention alert UI
- AI analysis view
- Candidate comparison
- Interview report
- Hiring recommendation
- Group discussion workspace
- Responsive professional UI using the Confira maroon/rose/cream palette

## Tech stack

- React 18
- Vite
- React Router
- Lucide React icons
- Plain CSS (no UI framework)

## Run

```bash
npm install
npm run dev
```

Open the URL shown by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Important

The application uses FastAPI and Supabase as the source of truth for authentication, profiles, jobs, applications, interviews, notifications, results, reports, and file storage. Camera, microphone, screen sharing, AI inference, and some live telemetry views still depend on their provider/runtime configuration.

## Suggested backend modules

- Auth / RBAC
- Resume parsing and scoring
- Interview scheduling
- WebRTC interview room
- Screen-share and browser-event telemetry
- Face / gaze / head-pose inference
- Voice / pronunciation / transcript analysis
- Expression authenticity research model
- Deepfake detection
- Candidate scoring and reporting
- WebSocket event stream

## Folder structure

```text
confira/
├─ public/
├─ src/
│  ├─ components/
│  ├─ data/
│  ├─ layouts/
│  ├─ pages/
│  │  ├─ auth/
│  │  ├─ candidate/
│  │  └─ interviewer/
│  ├─ App.jsx
│  ├─ main.jsx
│  └─ styles.css
├─ .env.example
├─ index.html
├─ package.json
└─ vite.config.js
```
### v2 live interview additions
- Candidate can join a live interview directly from My Interviews.
- Interviewer Live Monitoring shows candidate camera + screen and a dedicated right-side activity rail.
- Activity rail includes tab switch, browser focus, screen sharing, keyboard activity, face visibility and identity events.

### Live two-party interview
- Candidate and interviewer now have separate live interview room pages.
- Camera and microphone use browser media permissions.
- Peer-to-peer audio/video is wired with PeerJS.
- Socket.IO signaling is used for room join events.
- Interviewer has a dedicated real-time candidate activity rail.
- Backend endpoint can be supplied with VITE_API_URL (default http://localhost:8000).
