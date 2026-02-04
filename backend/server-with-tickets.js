import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3456;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Serve static frontend
app.use(express.static(join(__dirname, '../frontend/build')));
app.use(express.static(join(__dirname, '../frontend/public')));

// Load KB articles
let kbArticles = [];
let kbLoaded = false;

// Load Zoho tickets
let zohoTickets = [];
let ticketsLoaded = false;

async function loadKB() {
  try {
    const dataPath = join(__dirname, '../data/kb-articles.json');
    const data = await readFile(dataPath, 'utf8');
    kbArticles = JSON.parse(data);
    kbLoaded = true;
    console.log(`✅ Loaded ${kbArticles.length} KB articles`);
  } catch (error) {
    console.error('❌ Error loading KB:', error.message);
    kbArticles = [];
    kbLoaded = false;
  }
}

async function loadTickets() {
  try {
    const dataPath = join(__dirname, '../data/zoho-tickets.json');
    const data = await readFile(dataPath, 'utf8');
    zohoTickets = JSON.parse(data);
    ticketsLoaded = true;
    console.log(`✅ Loaded ${zohoTickets.length} Zoho support tickets`);
  } catch (error) {
    console.error('⚠️  No Zoho tickets found (run zoho-ticket-scraper.js)');
    zohoTickets = [];
    ticketsLoaded = false;
  }
}

// Initialize Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Search KB articles
function searchKB(query, limit = 3) {
  if (kbArticles.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);
  
  const scored = kbArticles.map(article => {
    const titleLower = article.title.toLowerCase();
    const contentLower = article.content.toLowerCase();
    const categoryLower = (article.category || '').toLowerCase();
    
    let score = 0;
    
    keywords.forEach(keyword => {
      if (titleLower.includes(keyword)) {
        score += 10;
        if (titleLower.startsWith(keyword)) score += 5;
      }
      if (categoryLower.includes(keyword)) score += 7;
      const contentMatches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
      score += Math.min(contentMatches, 5);
    });
    
    if (queryLower.length > 10 && contentLower.includes(queryLower)) {
      score += 15;
    }
    
    return { article, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.article);
}

// Search Zoho tickets
function searchTickets(query, limit = 5) {
  if (zohoTickets.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);
  
  const scored = zohoTickets.map(ticket => {
    const subjectLower = ticket.subject.toLowerCase();
    const descriptionLower = (ticket.description || '').toLowerCase();
    const resolutionLower = (ticket.resolution || '').toLowerCase();
    
    let score = 0;
    
    keywords.forEach(keyword => {
      if (subjectLower.includes(keyword)) {
        score += 10;
        if (subjectLower.startsWith(keyword)) score += 5;
      }
      
      const descMatches = (descriptionLower.match(new RegExp(keyword, 'g')) || []).length;
      score += Math.min(descMatches, 3);
      
      const resMatches = (resolutionLower.match(new RegExp(keyword, 'g')) || []).length;
      score += Math.min(resMatches, 5);
    });
    
    if (queryLower.length > 10) {
      if (subjectLower.includes(queryLower)) score += 15;
      if (descriptionLower.includes(queryLower)) score += 10;
      if (resolutionLower.includes(queryLower)) score += 12;
    }
    
    // Prefer resolved tickets (they have solutions)
    if (ticket.status === 'Closed' && ticket.resolution) {
      score += 3;
    }
    
    return { ticket, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.ticket);
}

// In-memory session store (use Redis in production)
const sessions = new Map();
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT) || 30 * 60 * 1000; // 30 minutes

// Clean up old sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sid, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(sid);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    kbLoaded,
    articles: kbArticles.length,
    ticketsLoaded,
    tickets: zohoTickets.length,
    activeSessions: sessions.size,
    uptime: process.uptime(),
    version: '1.1.0'
  });
});

// KB status endpoint
app.get('/api/kb/status', (req, res) => {
  const categories = [...new Set(kbArticles.map(a => a.category))];
  res.json({
    loaded: kbLoaded,
    articleCount: kbArticles.length,
    categories,
    ticketsLoaded,
    ticketCount: zohoTickets.length
  });
});

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    }
    
    // Get or create session
    const sid = sessionId || uuidv4();
    let session = sessions.get(sid);
    
    if (!session) {
      session = {
        id: sid,
        messages: [],
        createdAt: Date.now(),
        lastActivity: Date.now()
      };
      sessions.set(sid, session);
    }
    
    // Update session activity
    session.lastActivity = Date.now();
    
    // Search KB for relevant articles
    const relevantArticles = searchKB(message, 3);
    
    // Search Zoho tickets for relevant support cases
    const relevantTickets = searchTickets(message, 5);
    
    // Build knowledge context
    let knowledgeContext = '';
    
    if (relevantArticles.length > 0) {
      knowledgeContext += 'KNOWLEDGE BASE ARTICLES:\n\n';
      relevantArticles.forEach((article, idx) => {
        knowledgeContext += `Article ${idx + 1}: ${article.title}\n`;
        knowledgeContext += `Category: ${article.category}\n`;
        knowledgeContext += `Content: ${article.content.substring(0, 1500)}\n`;
        knowledgeContext += `URL: ${article.url}\n\n`;
      });
    }
    
    if (relevantTickets.length > 0) {
      knowledgeContext += '\nREAL SUPPORT TICKETS (PAST CUSTOMER ISSUES & RESOLUTIONS):\n\n';
      relevantTickets.forEach((ticket, idx) => {
        knowledgeContext += `Ticket ${idx + 1}: #${ticket.ticketNumber} - ${ticket.subject}\n`;
        knowledgeContext += `Status: ${ticket.status}\n`;
        if (ticket.description) {
          knowledgeContext += `Issue: ${ticket.description.substring(0, 500)}\n`;
        }
        if (ticket.resolution) {
          knowledgeContext += `Resolution: ${ticket.resolution.substring(0, 800)}\n`;
        }
        knowledgeContext += `\n`;
      });
    }
    
    if (!knowledgeContext) {
      knowledgeContext = 'No specific KB articles or support tickets found for this query. Use your general Mojo knowledge to help.';
    }
    
    // Build conversation history
    const conversationHistory = session.messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }));
    
    // Add user message to history
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now()
    });
    
    // System prompt
    const systemPrompt = `You are a helpful AI assistant for Mojo Dialer support. You have access to:
1. Official Mojo KB articles (documentation and guides)
2. Real support tickets from Zoho Desk (past customer issues and their resolutions)

CRITICAL RULES:
- ONLY answer questions about Mojo Dialer features, usage, troubleshooting, and configuration
- REFUSE to answer any questions not related to Mojo (weather, general topics, other software, etc.)
- If asked about non-Mojo topics, politely decline and redirect to Mojo support

Use the KB articles for official documentation and the support tickets to see how similar issues were resolved for real customers.

When relevant support tickets are provided, mention that you're drawing from actual customer cases that were successfully resolved.

Be helpful, concise, and accurate. If you're not sure about something, say so rather than guessing.

${knowledgeContext}`;
    
    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        ...conversationHistory,
        {
          role: 'user',
          content: message
        }
      ]
    });
    
    const assistantMessage = response.content[0].text;
    
    // Add assistant response to history
    session.messages.push({
      role: 'assistant',
      content: assistantMessage,
      timestamp: Date.now()
    });
    
    // Prepare article references for frontend
    const articlesUsed = relevantArticles.map(a => ({
      title: a.title,
      category: a.category,
      url: a.url
    }));
    
    // Return response
    res.json({
      response: assistantMessage,
      sessionId: sid,
      articlesUsed,
      ticketsUsed: relevantTickets.length,
      messageCount: session.messages.length
    });
    
  } catch (error) {
    console.error('Error in /api/chat:', error);
    
    if (error.status === 401) {
      return res.status(500).json({ error: 'Invalid API key' });
    }
    
    res.status(500).json({
      error: 'An error occurred processing your request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Catch-all for frontend routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../frontend/public/index.html'));
});

// Start server
async function startServer() {
  await loadKB();
  await loadTickets();
  
  app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log(`🚀 Mojo Chatbot Server running on port ${PORT}`);
    console.log(`📚 KB Articles: ${kbArticles.length}`);
    console.log(`🎫 Support Tickets: ${zohoTickets.length}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
    console.log('='.repeat(60) + '\n');
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
