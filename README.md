# Mojo Dialer Support AI - Professional Edition

A production-ready AI chatbot powered by **Claude 3.5 Sonnet** that provides instant support for Mojo Dialer questions.

## ✨ Features

**Core:**
- ✅ Powered by Claude 3.5 Sonnet
- ✅ Mojo-only responses (strictly enforced)
- ✅ Knowledge base integration (Mojo support articles)
- ✅ Session-based conversation memory
- ✅ Professional React-based UI

**Enterprise-Ready:**
- 🛡️ Rate limiting (100 requests per 15 min)
- 🔒 Security headers (Helmet.js)
- 📊 Health monitoring endpoints
- 🎨 Modern, responsive design
- 📱 Mobile-friendly interface
- 🔄 Automatic session cleanup
- 📝 Enhanced KB search algorithm
- ⚡ Optimized performance

## 🚀 Quick Start

### 1. Set up environment

```bash
cd ~/clawd/projects/mojo-chatbot-polished

# Copy environment template
cp .env.example .env

# Edit .env and add your API key
nano .env
```

Add to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3456
NODE_ENV=production
```

### 2. Deploy

```bash
./deploy.sh
```

### 3. Access

Open browser to: `http://localhost:3456`

## 📁 Project Structure

```
mojo-chatbot-polished/
├── backend/
│   ├── server.js          # Main API server
│   ├── scrape-kb.js       # KB scraper
│   └── package.json       # Dependencies
├── frontend/
│   └── public/
│       └── index.html     # React UI (single file)
├── data/
│   └── kb-articles.json   # KB data (10 articles)
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
├── deploy.sh              # Deployment script
├── README.md              # This file
└── DEPLOYMENT.md          # Detailed deployment guide
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key (required) | - |
| `PORT` | Server port | 3456 |
| `NODE_ENV` | Environment | production |
| `FRONTEND_URL` | CORS origin | * |
| `SESSION_TIMEOUT` | Session timeout (ms) | 1800000 |

### Rate Limiting

Default: 100 requests per 15 minutes per IP

Modify in `backend/server.js`:
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
```

## 🌐 Deployment Options

### Option 1: PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Deploy with script
./deploy.sh

# PM2 will manage the process
pm2 status
pm2 logs mojo-chatbot-pro
pm2 restart mojo-chatbot-pro
```

### Option 2: Direct Run

```bash
cd backend
export ANTHROPIC_API_KEY="sk-ant-..."
npm start
```

### Option 3: Nginx Reverse Proxy

Add to Nginx config (`/etc/nginx/sites-available/default`):

```nginx
location /mojo-demo-abc123xyz {
    proxy_pass http://localhost:3456;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Then:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Access at: `http://your-server.com/mojo-demo-abc123xyz`

## 📚 Knowledge Base

### Using Sample Data

10 comprehensive articles included covering:
- Getting Started
- Importing Contacts
- Power Dialer Setup
- Troubleshooting Audio
- Email Integration
- DNC Management
- Action Plans
- Mobile App
- Calendar & Tasks
- Reports & Analytics

### Scraping Full KB

To scrape all articles from the live Mojo KB:

```bash
cd backend
npm run scrape
```

This will:
- Scrape 15 KB categories
- Extract ~50-100 articles
- Save to `../data/kb-articles.json`
- Takes 5-10 minutes
- Includes rate limiting (be nice to their server!)

## 🔍 API Endpoints

### POST /api/chat

Send a message and get AI response.

**Request:**
```json
{
  "message": "How do I import contacts?",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "response": "To import contacts into Mojo...",
  "sessionId": "generated-or-provided",
  "articlesUsed": [
    {
      "title": "How to Import Contacts",
      "category": "importing-and-adding-data",
      "url": "https://..."
    }
  ],
  "messageCount": 5
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "kbLoaded": true,
  "articles": 10,
  "activeSessions": 3,
  "uptime": 12345,
  "version": "1.0.0"
}
```

### GET /api/kb/status

KB status information.

**Response:**
```json
{
  "loaded": true,
  "articleCount": 10,
  "categories": [
    "getting-started",
    "power-dialer",
    ...
  ]
}
```

## 💰 Cost Estimate

**Claude 3.5 Sonnet Pricing:**
- Input: $3 per million tokens
- Output: $15 per million tokens

**Typical Usage:**
- ~800 tokens per request (KB context + history + prompt)
- ~300 tokens per response
- **Cost per conversation turn: ~$0.007**
- 1,000 messages ≈ $7
- 10,000 messages ≈ $70

Very economical for a demo!

## 🛠️ Customization

### Change UI Colors

Edit `frontend/public/index.html`:

```css
/* Primary color (Mojo orange) */
background: linear-gradient(135deg, #e46317 0%, #c85515 100%);

/* Adjust to your brand */
background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);
```

### Adjust KB Search

Edit `backend/server.js` → `searchKB()` function:

```javascript
// Current scoring:
// Title match: 10 points
// Category match: 7 points
// Content match: 1 point per occurrence (max 5)

// Customize as needed
```

### Switch to Claude 3.7 Sonnet

Edit `backend/server.js`:

```javascript
model: 'claude-3-7-sonnet-20250219',  // Latest model
```

## 🧪 Testing

### Test the API

```bash
curl -X POST http://localhost:3456/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I import contacts?"}'
```

### Test Health Endpoint

```bash
curl http://localhost:3456/api/health
```

### Test Example Prompts

- "How do I import contacts?"
- "My audio isn't working during calls"
- "How do I set up the power dialer?"
- "What's the mobile app called?"
- "How do I manage do not call lists?"
- "Tell me about action plans"
- "What is the weather?" (should refuse - not Mojo related)

## 🐛 Troubleshooting

**Server won't start:**
- Check `ANTHROPIC_API_KEY` is set
- Verify port 3456 is available: `lsof -i :3456`
- Check logs: `pm2 logs mojo-chatbot-pro`

**KB not loading:**
- Verify `data/kb-articles.json` exists
- Check JSON is valid: `cat data/kb-articles.json | jq`
- Check file permissions

**API errors:**
- 429: Rate limit exceeded - wait or adjust limits
- 401: Invalid API key
- 500: Check server logs for details

**Poor responses:**
- Run KB scraper to get more content
- Check that relevant articles exist for the topic
- Review system prompt in `server.js`

## 📊 Monitoring

### PM2 Monitoring

```bash
pm2 status          # Process status
pm2 logs            # Live logs
pm2 monit           # Resource usage
pm2 restart all     # Restart
```

### Health Checks

Set up automated health checks:

```bash
# Cron job (every 5 minutes)
*/5 * * * * curl -f http://localhost:3456/api/health || systemctl restart mojo-chatbot-pro
```

## 🔒 Security

**Included:**
- Helmet.js security headers
- Rate limiting
- Input validation
- CORS configuration
- No sensitive data stored

**For Production:**
- Use HTTPS (Let's Encrypt)
- Set specific CORS origins
- Monitor API usage
- Regular dependency updates
- Log aggregation
- Backup strategy

## 📝 License

Proprietary - For Mojo/Apertoura internal use only.

## 🤝 Support

Built by: ApertouraBOT  
Date: 2026-02-04  
Stack: Node.js + Express + Claude 3.5 Sonnet + React

For questions or issues, contact Yaroslav.

---

**Ready to go!** Just set your API key and run `./deploy.sh` 🚀
