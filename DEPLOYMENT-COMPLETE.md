# 🚀 Mojo Chatbot - DEPLOYED (Needs API Key)

## ✅ What's Done

- **Server running** on AWS
- **Port 3456 open** in security group
- **25 KB articles** loaded
- **1,767 Zoho tickets** scraping (in progress)

## 🌐 Public URL

**http://100.27.112.99:3456**

## ⚠️ Issue: API Key

The OAuth token (`sk-ant-oat01-*`) doesn't work for direct API calls.

OAuth tokens are for browser/CLI authentication, not API usage.

### Need: Regular Anthropic API Key

Format: `sk-ant-api03-*`

**Get one at:** https://console.anthropic.com/settings/keys

### To Fix

1. Get regular API key from Anthropic Console
2. Update `.env` file:
   ```bash
   nano ~/clawd/projects/mojo-chatbot-polished/backend/.env
   # Replace the sk-ant-oat01-* with sk-ant-api03-*
   ```
3. Restart server:
   ```bash
   kill $(ps aux | grep "node server.js" | grep -v grep | awk '{print $2}')
   cd ~/clawd/projects/mojo-chatbot-polished/backend
   node server.js &
   ```

## 📊 Status

| Component | Status |
|-----------|--------|
| Server | ✅ Running |
| Port open | ✅ 3456 |
| KB articles | ✅ 25 loaded |
| Zoho tickets | ⏳ Scraping (297/1767) |
| API key | ❌ OAuth token won't work |
| Public URL | ✅ http://100.27.112.99:3456 |

## 🧪 Test When Ready

```bash
curl -X POST http://100.27.112.99:3456/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Mojo Dialer?"}'
```

Should return a helpful response about Mojo.

## 📝 Files

- Server: `/home/ubuntu/clawd/projects/mojo-chatbot-polished/backend/server.js`
- Config: `/home/ubuntu/clawd/projects/mojo-chatbot-polished/backend/.env`
- KB Data: `/home/ubuntu/clawd/projects/mojo-chatbot-polished/data/kb-articles.json`
- Tickets: `/home/ubuntu/clawd/projects/mojo-chatbot-polished/data/zoho-tickets.json` (when scraping completes)

## 🔧 Commands

**Check server status:**
```bash
curl http://100.27.112.99:3456/api/health
```

**View server logs:**
```bash
ps aux | grep "node server.js" | grep -v grep
```

**Restart server:**
```bash
kill $(ps aux | grep "node server.js" | grep -v grep | awk '{print $2}')
cd ~/clawd/projects/mojo-chatbot-polished/backend && node server.js &
```

**Update to tickets version (when scraping done):**
```bash
kill $(ps aux | grep "node server.js" | grep -v grep | awk '{print $2}')
cd ~/clawd/projects/mojo-chatbot-polished/backend
node server-with-tickets.js &
```

---

**Next:** Add regular Anthropic API key and test! 🎉
