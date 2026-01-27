# OneClick Voice Waste Tracker

A voice-enabled food waste tracking kiosk demo built with Flask and Claude AI.

## Features

- **Voice Input**: Tap the big blue button and speak naturally to log waste
- **Camera Capture**: Automatically captures employee photo for accountability
- **AI Interpretation**: Claude AI parses natural language into structured data
- **Auto-Confirm**: 5-second countdown for fast, hands-free logging
- **Clean UI**: OneClick-branded professional interface

## Quick Start

### Local Development (Simple Server)

```bash
cd oneclick-waste-tracker
python3 run_simple.py
```

Visit http://localhost:5000

### Local Development (Flask)

```bash
cd oneclick-waste-tracker
pip install -r requirements.txt
export ANTHROPIC_API_KEY=your-api-key
python app.py
```

## Deploy to Render

1. Push this folder to a GitHub repository
2. Go to [render.com](https://render.com) and create a new Web Service
3. Connect your GitHub repo
4. Add environment variable: `ANTHROPIC_API_KEY`
5. Deploy!

The `render.yaml` file is included for automatic configuration.

## Deploy to Heroku

```bash
heroku create oneclick-waste-tracker
heroku config:set ANTHROPIC_API_KEY=your-api-key
git push heroku main
```

## Deploy with Docker

```bash
docker build -t oneclick-waste .
docker run -p 5000:5000 -e ANTHROPIC_API_KEY=your-key oneclick-waste
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main kiosk UI |
| `/api/parse` | POST | Parse voice transcript |
| `/api/log` | POST | Confirm and log waste entry |
| `/api/log` | GET | Get recent entries |
| `/api/summary` | GET | Get waste summary by category |
| `/health` | GET | Health check |

## Example Voice Commands

- "I threw away 50 chicken filets"
- "Wasted 10 pounds of flour"
- "Dumped 2 gallons of lemonade"
- "25 biscuits expired"
- "3 bags of lettuce went bad"

## File Structure

```
oneclick-waste-tracker/
├── app.py              # Flask backend + Claude API
├── run_simple.py       # Simple server (no dependencies)
├── requirements.txt    # Python dependencies
├── Dockerfile          # Docker deployment
├── Procfile           # Heroku deployment
├── render.yaml        # Render.com config
├── static/
│   ├── styles.css     # OneClick brand styling
│   └── script.js      # Voice, camera, UI logic
└── templates/
    └── index.html     # Kiosk layout
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | Claude API key for AI parsing |
| `PORT` | No | Server port (default: 5000) |

*Without the API key, the app uses a basic keyword parser.

## Browser Support

- Chrome/Edge (full support)
- Safari (requires HTTPS for mic)
- Firefox (limited speech recognition)

Best used on iPad or touchscreen kiosk.
