# 🚀 Mojo Chatbot - Deployment Instructions

## Current Status

✅ **Built:** 20 comprehensive KB articles  
✅ **Location:** `~/clawd/projects/mojo-chatbot-polished/`  
✅ **Dependencies:** Installed  
⏳ **API Key:** Needs to be configured  

---

## Quick Deploy (3 Steps)

### 1. Add Your API Key

Edit the `.env` file:

```bash
cd ~/clawd/projects/mojo-chatbot-polished
nano .env
```

Replace `sk-ant-YOUR_KEY_HERE` with your actual Anthropic API key.

**Get a key:** https://console.anthropic.com/settings/keys  
**Or use existing:** Check `~/clawd/scripts/anthropic-key-manager.sh status`

### 2. Start the Server

```bash
cd ~/clawd/projects/mojo-chatbot-polished/backend
npm start
```

The server will start on port 3456.

### 3. Access the Chatbot

**Option A - Direct Access (Local Testing):**
```
http://localhost:3456
```

**Option B - Public Access (AWS):**

Get your AWS instance public IP:
```bash
curl -s http://169.254.169.254/latest/meta-data/public-ipv4
```

Then access at:
```
http://YOUR_AWS_IP:3456
```

**Security Note:** Port 3456 must be open in AWS Security Group.

---

## Production Deployment (Recommended)

### Option 1: PM2 Process Manager

```bash
# Install PM2 if not already installed
npm install -g pm2

# Start with PM2
cd ~/clawd/projects/mojo-chatbot-polished/backend
pm2 start server.js --name mojo-chatbot --env production

# Save PM2 config
pm2 save
pm2 startup

# Monitor
pm2 logs mojo-chatbot
pm2 status
```

### Option 2: Nginx Reverse Proxy (Custom URL)

**Random URL generated:** `/mojo-eaefece904aabe25`

Add to Nginx config (`/etc/nginx/sites-available/default`):

```nginx
location /mojo-eaefece904aabe25 {
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

Then reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Access at: `http://YOUR_DOMAIN/mojo-eaefece904aabe25`

---

## AWS Security Group Setup

To allow external access on port 3456:

1. Go to AWS EC2 Console
2. Select your instance
3. Click Security tab → Security groups
4. Edit inbound rules
5. Add rule:
   - Type: Custom TCP
   - Port: 3456
   - Source: 0.0.0.0/0 (or your IP for security)
6. Save

---

## Testing

Once running, test with:

```bash
# Health check
curl http://localhost:3456/api/health

# KB status
curl http://localhost:3456/api/kb/status

# Test chat
curl -X POST http://localhost:3456/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I import contacts?"}'
```

---

## Sample Prompts to Try

**Good (Mojo-related):**
- "How do I import contacts?"
- "My audio isn't working during calls"
- "What's the mobile app called?"
- "How do I set up the power dialer?"
- "Tell me about action plans"
- "What are the different pricing plans?"
- "How do SMS messages work?"

**Bad (Non-Mojo - should refuse):**
- "What's the weather?"
- "Tell me a joke"
- "How do I use Salesforce?"

---

## KB Content

**20 Comprehensive Articles:**
1. Getting Started
2. Importing Contacts
3. Power Dialer Setup
4. Audio Troubleshooting
5. Email Integration
6. DNC Management
7. Action Plans
8. Mobile App
9. Calendar & Tasks
10. Reports & Analytics
11. Pricing & Plans
12. Calling Lists
13. Integrations
14. Voicemail Drops
15. Call Recording
16. Tags & Custom Fields
17. Lead Services
18. Team Management
19. SMS Texting
20. Contact Status

Each article: 300-800 words of detailed Mojo information.

---

## Monitoring & Management

### PM2 Commands
```bash
pm2 status              # Check status
pm2 logs mojo-chatbot   # View logs
pm2 restart mojo-chatbot  # Restart
pm2 stop mojo-chatbot   # Stop
pm2 delete mojo-chatbot # Remove
```

### Direct Run (Development)
```bash
cd backend
npm start
# Ctrl+C to stop
```

### Health Monitoring
Set up cron job for automated health checks:
```bash
# Add to crontab
*/5 * * * * curl -f http://localhost:3456/api/health || systemctl restart mojo-chatbot
```

---

## Cost Estimate

**Claude 3.5 Sonnet:**
- ~$0.007 per conversation turn
- 100 messages/day = $21/month
- 1,000 messages/day = $210/month

**Very economical for a demo!**

---

## Troubleshooting

**Server won't start:**
- Check API key is set correctly in `.env`
- Verify port 3456 is available: `lsof -i :3456`
- Check logs: `pm2 logs` or console output

**Can't access from browser:**
- Check AWS Security Group allows port 3456
- Verify server is running: `curl http://localhost:3456/api/health`
- Check firewall: `sudo ufw status`

**API errors:**
- 401: Invalid API key
- 429: Rate limit exceeded
- 500: Check server logs

**Poor responses:**
- Check KB loaded: `curl http://localhost:3456/api/kb/status`
- Verify `data/kb-articles.json` exists and is valid JSON

---

## Next Steps

1. ✅ Add your API key to `.env`
2. ✅ Start the server
3. ✅ Test locally
4. ✅ (Optional) Set up PM2
5. ✅ (Optional) Configure Nginx
6. ✅ Share with client!

---

**Ready to go!** 🚀

**Your custom URL:** `/mojo-eaefece904aabe25`
