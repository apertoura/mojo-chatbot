import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, appendFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3456;

// --- Corrections Store ---
const CORRECTIONS_PATH = join(__dirname, '../data/corrections.json');
let corrections = [];

async function loadCorrections() {
  try {
    const data = await readFile(CORRECTIONS_PATH, 'utf8');
    corrections = JSON.parse(data);
    console.log(`✅ Loaded ${corrections.length} user corrections`);
  } catch (error) {
    console.log('ℹ️  No corrections file found (will be created when needed)');
    corrections = [];
  }
}

async function saveCorrections() {
  try {
    await writeFile(CORRECTIONS_PATH, JSON.stringify(corrections, null, 2));
  } catch (err) {
    console.error('Failed to save corrections:', err.message);
  }
}

// Search corrections for similar questions
function searchCorrections(query, limit = 3) {
  if (corrections.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);
  const stopWords = ['how', 'what', 'where', 'when', 'why', 'can', 'does', 'the', 'and', 'for', 'with', 'about', 'help', 'need', 'want', 'please', 'mojo'];
  const topicKeywords = keywords.filter(k => !stopWords.includes(k));
  
  const scored = corrections.map(corr => {
    const questionLower = corr.question.toLowerCase();
    const correctionLower = corr.correction.toLowerCase();
    
    let score = 0;
    
    // Exact phrase match in original question — strongest signal
    if (questionLower.includes(queryLower) || queryLower.includes(questionLower)) {
      score += 50;
    }
    
    topicKeywords.forEach(keyword => {
      if (questionLower.includes(keyword)) score += 15;
      if (correctionLower.includes(keyword)) score += 5;
    });
    
    // All keywords present bonus
    const allPresent = topicKeywords.every(k => questionLower.includes(k) || correctionLower.includes(k));
    if (allPresent && topicKeywords.length > 0) score += 20;
    
    return { correction: corr, score };
  });
  
  return scored
    .filter(s => s.score > 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.correction);
}

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

// Data stores
let kbArticles = [];
let kbLoaded = false;

let zohoTickets = [];
let ticketsLoaded = false;

let mojosellsPages = [];
let mojosellsLoaded = false;

// Load KB articles
async function loadKB() {
  try {
    const dataPath = join(__dirname, '../data/kb-articles.json');
    const data = await readFile(dataPath, 'utf8');
    kbArticles = JSON.parse(data);
    kbLoaded = true;
    console.log(`✅ Loaded ${kbArticles.length} KB articles`);
  } catch (error) {
    console.error('⚠️  No KB articles found:', error.message);
    kbArticles = [];
    kbLoaded = false;
  }
}

// Load Zoho tickets
async function loadTickets() {
  try {
    const dataPath = join(__dirname, '../data/zoho-tickets.json');
    const data = await readFile(dataPath, 'utf8');
    zohoTickets = JSON.parse(data);
    ticketsLoaded = true;
    console.log(`✅ Loaded ${zohoTickets.length} Zoho support tickets`);
  } catch (error) {
    console.error('⚠️  No Zoho tickets found (optional)');
    zohoTickets = [];
    ticketsLoaded = false;
  }
}

// Load mojosells.com scraped pages
async function loadMojosells() {
  try {
    const dataPath = join(__dirname, '../data/mojosells-pages.json');
    const data = await readFile(dataPath, 'utf8');
    mojosellsPages = JSON.parse(data);
    mojosellsLoaded = true;
    console.log(`✅ Loaded ${mojosellsPages.length} mojosells.com pages`);
  } catch (error) {
    console.error('⚠️  No mojosells.com scraped data found (optional)');
    mojosellsPages = [];
    mojosellsLoaded = false;
  }
}

// Initialize Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Escape special regex characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Search KB articles
function searchKB(query, limit = 5) {
  if (kbArticles.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);
  
  // Extract key topic words (remove common words)
  const stopWords = ['how', 'what', 'where', 'when', 'why', 'can', 'does', 'the', 'and', 'for', 'with', 'about', 'help', 'need', 'want', 'please', 'mojo'];
  const topicKeywords = keywords.filter(k => !stopWords.includes(k));
  
  const scored = kbArticles.map(article => {
    const titleLower = article.title.toLowerCase();
    const contentLower = article.content.toLowerCase();
    const categoryLower = (article.category || '').toLowerCase();
    const descLower = (article.description || '').toLowerCase();
    
    let score = 0;
    
    // Exact phrase match in title - highest priority
    if (titleLower.includes(queryLower)) {
      score += 50;
    }
    
    // Topic keyword matches
    topicKeywords.forEach(keyword => {
      // Title matches are most important
      if (titleLower.includes(keyword)) {
        score += 20;
        if (titleLower.startsWith(keyword)) score += 10;
      }
      // Category match
      if (categoryLower.includes(keyword)) score += 15;
      // Description match
      if (descLower.includes(keyword)) score += 10;
      // Content matches (count occurrences)
      const contentMatches = (contentLower.match(new RegExp(escapeRegex(keyword), 'g')) || []).length;
      score += Math.min(contentMatches * 2, 15);
    });
    
    // All keywords present bonus
    const allKeywordsPresent = topicKeywords.every(k => 
      titleLower.includes(k) || contentLower.includes(k)
    );
    if (allKeywordsPresent && topicKeywords.length > 0) {
      score += 25;
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
function searchTickets(query, limit = 3) {
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
      
      const descMatches = (descriptionLower.match(new RegExp(escapeRegex(keyword), 'g')) || []).length;
      score += Math.min(descMatches, 3);
      
      const resMatches = (resolutionLower.match(new RegExp(escapeRegex(keyword), 'g')) || []).length;
      score += Math.min(resMatches, 5);
    });
    
    if (queryLower.length > 10) {
      if (subjectLower.includes(queryLower)) score += 15;
      if (descriptionLower.includes(queryLower)) score += 10;
      if (resolutionLower.includes(queryLower)) score += 12;
    }
    
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

// Search mojosells.com pages
function searchMojosells(query, limit = 3) {
  if (mojosellsPages.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);
  
  const scored = mojosellsPages.map(page => {
    const titleLower = (page.title || '').toLowerCase();
    const contentLower = (page.content || '').toLowerCase();
    const urlLower = (page.url || '').toLowerCase();
    
    let score = 0;
    
    keywords.forEach(keyword => {
      if (titleLower.includes(keyword)) {
        score += 10;
        if (titleLower.startsWith(keyword)) score += 5;
      }
      if (urlLower.includes(keyword)) score += 5;
      const contentMatches = (contentLower.match(new RegExp(escapeRegex(keyword), 'g')) || []).length;
      score += Math.min(contentMatches, 5);
    });
    
    if (queryLower.length > 10 && contentLower.includes(queryLower)) {
      score += 15;
    }
    
    return { page, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.page);
}

// In-memory session store
const sessions = new Map();
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT) || 30 * 60 * 1000;

// Clean up old sessions
setInterval(() => {
  const now = Date.now();
  for (const [sid, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(sid);
    }
  }
}, 5 * 60 * 1000);

// Conversation logging - grouped by IP
const LOGS_DIR = join(__dirname, '../logs');

// Initialize logs directory
(async () => {
  try {
    await mkdir(LOGS_DIR, { recursive: true });
    console.log('📝 Conversation logging enabled');
  } catch (err) {
    console.error('Failed to create logs directory:', err);
  }
})();

// Sanitize IP for filename
function sanitizeIP(ip) {
  return (ip || 'unknown').replace(/[^a-zA-Z0-9.-]/g, '_').replace(/:+/g, '-');
}

// Get client IP (handles proxies)
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || req.headers['x-real-ip'] 
    || req.socket?.remoteAddress 
    || 'unknown';
}

// Log conversation entry
async function logConversation(ip, sessionId, role, content, metadata = {}) {
  const sanitizedIP = sanitizeIP(ip);
  const logFile = join(LOGS_DIR, `${sanitizedIP}.jsonl`);
  const timestamp = new Date().toISOString();
  
  const entry = {
    timestamp,
    sessionId,
    role,
    content: content, // Full content, no truncation
    ...metadata
  };
  
  try {
    await appendFile(logFile, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('Failed to log conversation:', err.message);
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    sources: {
      kb: { loaded: kbLoaded, count: kbArticles.length },
      tickets: { loaded: ticketsLoaded, count: zohoTickets.length },
      mojosells: { loaded: mojosellsLoaded, count: mojosellsPages.length }
    },
    activeSessions: sessions.size,
    uptime: process.uptime(),
    version: '2.0.0'
  });
});

// KB status
app.get('/api/kb/status', (req, res) => {
  res.json({
    kb: {
      loaded: kbLoaded,
      count: kbArticles.length,
      categories: [...new Set(kbArticles.map(a => a.category))].filter(Boolean)
    },
    tickets: {
      loaded: ticketsLoaded,
      count: zohoTickets.length
    },
    mojosells: {
      loaded: mojosellsLoaded,
      count: mojosellsPages.length
    }
  });
});

// --- Correction Endpoint ---
app.post('/api/correction', async (req, res) => {
  try {
    const { question, aiResponse, correction, sessionId, messageIndex } = req.body;
    const clientIP = getClientIP(req);
    
    if (!question || !correction) {
      return res.status(400).json({ error: 'Question and correction are required' });
    }
    
    const entry = {
      id: uuidv4(),
      question: question.trim(),
      aiResponse: (aiResponse || '').trim(),
      correction: correction.trim(),
      sessionId: sessionId || null,
      messageIndex: messageIndex || null,
      submittedAt: new Date().toISOString(),
      ip: clientIP
    };
    
    corrections.push(entry);
    await saveCorrections();
    
    // Log the correction
    logConversation(clientIP, sessionId || 'unknown', 'correction', correction, {
      question,
      aiResponse: (aiResponse || '').substring(0, 300),
      correctionId: entry.id
    });
    
    console.log(`📝 Correction #${corrections.length} saved: "${question.substring(0, 60)}..." → "${correction.substring(0, 60)}..."`);
    
    res.json({ 
      success: true, 
      message: 'Thank you! Your correction has been saved and will improve future responses.',
      correctionId: entry.id,
      totalCorrections: corrections.length
    });
  } catch (error) {
    console.error('Correction save error:', error);
    res.status(500).json({ error: 'Failed to save correction' });
  }
});

// --- Get corrections count (for admin/debug) ---
app.get('/api/corrections/stats', (req, res) => {
  res.json({
    total: corrections.length,
    recent: corrections.slice(-5).map(c => ({
      question: c.question.substring(0, 80),
      correction: c.correction.substring(0, 80),
      submittedAt: c.submittedAt
    }))
  });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const clientIP = getClientIP(req);
    
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
    
    session.lastActivity = Date.now();
    
    // Search all data sources
    const kbResults = searchKB(message, 5);
    const ticketResults = searchTickets(message, 2);
    const mojosellsResults = searchMojosells(message, 2);
    const correctionResults = searchCorrections(message, 3);
    
    // Build context from all sources
    let context = '';
    
    // Corrections go FIRST — authoritative adjustments
    if (correctionResults.length > 0) {
      context += '=== ⚠️ USER CORRECTIONS (AUTHORITATIVE) ===\n';
      context += 'These corrections were submitted by real users/experts who found specific facts in previous answers to be wrong.\n';
      context += 'IMPORTANT: Do NOT replace your full answer with the correction. Instead:\n';
      context += '- Still give a complete, helpful answer using KB articles and other sources\n';
      context += '- But APPLY these corrections to fix any inaccurate facts in your response\n';
      context += '- The correction tells you what was WRONG — make sure your answer gets it RIGHT\n';
      context += '- If the question still needs clarification, STILL ask for clarification\n';
      context += '  but make sure the options you offer are accurate (remove any wrong options the correction flags)\n\n';
      correctionResults.forEach((corr, i) => {
        context += `[CORRECTION-${i + 1}]\n`;
        context += `When asked: ${corr.question}\n`;
        context += `What was wrong in previous answer: ${corr.aiResponse ? corr.aiResponse.substring(0, 200) : 'N/A'}\n`;
        context += `Correct fact: ${corr.correction}\n\n`;
      });
    }
    
    if (kbResults.length > 0) {
      context += '=== KNOWLEDGE BASE ARTICLES ===\n\n';
      kbResults.forEach((article, i) => {
        context += `[KB-${i + 1}] ${article.title}\n`;
        context += `Category: ${article.category || 'General'}\n`;
        context += `Content: ${article.content.substring(0, 1500)}...\n`;
        context += `URL: ${article.url}\n\n`;
      });
    }
    
    if (ticketResults.length > 0) {
      context += '=== SUPPORT TICKETS (Real Customer Issues) ===\n\n';
      ticketResults.forEach((ticket, i) => {
        context += `[TICKET-${i + 1}] ${ticket.subject}\n`;
        context += `Status: ${ticket.status}\n`;
        if (ticket.description) {
          context += `Issue: ${ticket.description.substring(0, 500)}...\n`;
        }
        if (ticket.resolution) {
          context += `Solution: ${ticket.resolution.substring(0, 600)}...\n`;
        }
        context += '\n';
      });
    }
    
    if (mojosellsResults.length > 0) {
      context += '=== MOJOSELLS.COM PAGES ===\n\n';
      mojosellsResults.forEach((page, i) => {
        context += `[WEB-${i + 1}] ${page.title || 'Page'}\n`;
        context += `URL: ${page.url}\n`;
        context += `Content: ${page.content.substring(0, 600)}...\n\n`;
      });
    }
    
    if (!context) {
      context = 'No relevant documentation found. Use your general knowledge about CRM and dialer systems to help.';
    }
    
    // Add user message to session
    session.messages.push({
      role: 'user',
      content: message
    });
    
    // Log user message with search context
    logConversation(clientIP, sid, 'user', message, {
      debug: {
        messageLength: message.length,
        isNewSession: session.messages.length === 1,
        userAgent: req.headers['user-agent']?.substring(0, 100)
      }
    });
    
    // Build system prompt
    const systemPrompt = `You are a helpful, conversational Mojo Dialer support assistant.

RESPONSE FORMAT:
You MUST respond with valid JSON only. No text outside the JSON.

When you can answer the question clearly:
{"type":"answer","message":"Your detailed answer here using markdown formatting"}

When the question is vague, ambiguous, or could mean several things — ask for clarification:
{"type":"clarification","message":"A friendly clarifying question","options":["Option A","Option B","Option C"]}

Rules for clarification:
- Provide 2-4 specific options that cover the most likely interpretations
- Options should be short (under 10 words each)
- The user can always type a custom response, so don't try to cover every possibility
- Only ask for clarification when genuinely needed — if you can give a good answer, just answer
- Examples of when to clarify: "it's not working" (what specifically?), "how do I set up" (set up what feature?), "having problems" (what kind?), "how do I download/install" (which platform?)
- IMPORTANT: User corrections do NOT remove the need for clarification. If a question would normally
  need clarification, STILL ask for clarification — but use the corrections to ensure your options
  are accurate. For example, if a correction says "there is no desktop app", still ask the user
  what they mean, but remove "Desktop app" from the options and only show valid options.

Guidelines for answers:
- USE THE KNOWLEDGE BASE ARTICLES THOROUGHLY - they contain detailed, accurate information
- Provide complete, detailed answers using all relevant information from the KB articles
- Give step-by-step instructions when the KB has them
- Be concise but comprehensive - don't skip important details from the KB
- Give direct answers without explaining your sources
- Do NOT say "based on documentation", "based on tickets", "according to our records", etc.
- Just answer naturally as if you know the information
- If you don't have the answer, say so briefly
- Use markdown formatting in your message (bold, lists, headers)

IMPORTANT: If user corrections are present below, they are AUTHORITATIVE facts from real experts.
Do NOT just parrot the correction as your whole answer. Give a full, helpful response but make sure
the corrected facts are accurately reflected. Think of corrections as "this specific thing was wrong,
fix it" — your job is still to give a complete answer, just one that incorporates the corrected info.
KB articles are your PRIMARY source. Support tickets are supplementary context.

Reference information:
${context}`;
    
    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: session.messages.slice(-10) // Last 10 messages for context
    });
    
    const rawResponse = response.content[0].text;
    
    // Parse structured JSON response from Claude
    let responseType = 'answer';
    let assistantMessage = rawResponse;
    let suggestedReplies = null;
    
    try {
      // Try to parse JSON — Claude should return structured response
      const parsed = JSON.parse(rawResponse);
      if (parsed.type && parsed.message) {
        responseType = parsed.type;
        assistantMessage = parsed.message;
        if (parsed.type === 'clarification' && Array.isArray(parsed.options)) {
          suggestedReplies = parsed.options;
        }
      }
    } catch {
      // If Claude didn't return valid JSON, use raw text as-is (graceful fallback)
      responseType = 'answer';
      assistantMessage = rawResponse;
    }
    
    // Add assistant response to session (store the readable message, not JSON)
    session.messages.push({
      role: 'assistant',
      content: assistantMessage
    });
    
    // Log assistant response with full debug data
    logConversation(clientIP, sid, 'assistant', assistantMessage, {
      responseType,
      suggestedReplies,
      debug: {
        sourcesUsed: {
          corrections: correctionResults.map(c => ({
            question: c.question.substring(0, 100),
            correction: c.correction.substring(0, 100)
          })),
          kb: kbResults.map(a => ({ 
            title: a.title, 
            url: a.url, 
            category: a.category,
            relevance: a.content.substring(0, 200) + '...'
          })),
          tickets: ticketResults.map(t => ({ 
            subject: t.subject, 
            status: t.status,
            hasResolution: !!t.resolution
          })),
          mojosells: mojosellsResults.map(p => ({ 
            title: p.title, 
            url: p.url 
          }))
        },
        contextLength: context.length,
        messagesInContext: Math.min(session.messages.length, 10)
      }
    });
    
    // Prepare response with sources used
    const sourcesUsed = {
      corrections: correctionResults.map(c => ({ question: c.question, correction: c.correction })),
      kb: kbResults.map(a => ({ title: a.title, url: a.url, category: a.category })),
      tickets: ticketResults.map(t => ({ subject: t.subject, status: t.status })),
      mojosells: mojosellsResults.map(p => ({ title: p.title, url: p.url }))
    };
    
    res.json({
      response: assistantMessage,
      responseType,
      suggestedReplies,
      sessionId: sid,
      sourcesUsed,
      correctionsApplied: correctionResults.length,
      articlesUsed: kbResults.map(a => ({ title: a.title, url: a.url }))
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    
    if (error.status === 401) {
      return res.status(500).json({ 
        error: 'Invalid API credentials' 
      });
    }
    
    res.status(500).json({ 
      error: 'An error occurred processing your message. Please try again.' 
    });
  }
});

// Frontend fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../frontend/public/index.html'));
});

// Start server
async function start() {
  await Promise.all([
    loadKB(),
    loadTickets(),
    loadMojosells(),
    loadCorrections()
  ]);
  
  app.listen(PORT, () => {
    console.log(`\n🚀 Mojo Chatbot API running on port ${PORT}`);
    console.log(`\n📊 Data Sources:`);
    console.log(`   KB Articles: ${kbLoaded ? '✅' : '❌'} (${kbArticles.length})`);
    console.log(`   Support Tickets: ${ticketsLoaded ? '✅' : '⚠️ '} (${zohoTickets.length})`);
    console.log(`   Mojosells.com: ${mojosellsLoaded ? '✅' : '⚠️ '} (${mojosellsPages.length})`);
    console.log(`   User Corrections: ✅ (${corrections.length})`);
    console.log(`\nReady to serve! 🎉\n`);
  });
}

start().catch(console.error);
