import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile } from 'fs/promises';
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

// Data stores
let kbArticles = [];
let kbLoaded = false;

let zohoTickets = [];
let ticketsLoaded = false;

let mojosellsPages = [];
let mojosellsLoaded = false;

let corrections = [];
let correctionsLoaded = false;

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

// Load user corrections
async function loadCorrections() {
  try {
    const dataPath = join(__dirname, '../data/corrections.json');
    const data = await readFile(dataPath, 'utf8');
    corrections = JSON.parse(data);
    correctionsLoaded = true;
    console.log(`✅ Loaded ${corrections.length} user corrections`);
  } catch (error) {
    console.log('ℹ️  No corrections file found (will be created when needed)');
    corrections = [];
    correctionsLoaded = true; // Mark as loaded even if empty
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
  
  // Filter out common/stop words and clean keywords
  const stopWords = new Set(['how', 'do', 'i', 'the', 'a', 'an', 'to', 'in', 'on', 'for', 'with', 'from', 'can', 'what', 'when', 'where', 'why', 'my', 'is', 'are', 'it', 'this', 'that', 'and', 'or', 'but']);
  const keywords = queryLower
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(k => k.length > 2 && !stopWords.has(k));
  
  if (keywords.length === 0) return [];
  
  const scored = kbArticles.map(article => {
    const titleLower = article.title.toLowerCase();
    const contentLower = article.content.toLowerCase();
    const categoryLower = (article.category || '').toLowerCase();
    
    let score = 0;
    
    // Exact phrase match in title (very high score)
    if (titleLower.includes(queryLower)) {
      score += 100;
    }
    
    // Exact phrase match in content (high score)
    if (contentLower.includes(queryLower)) {
      score += 50;
    }
    
    // Keyword matches
    keywords.forEach(keyword => {
      if (titleLower.includes(keyword)) {
        score += 20; // Increased from 10
        if (titleLower.startsWith(keyword)) score += 10;
      }
      if (categoryLower.includes(keyword)) score += 10;
      
      const contentMatches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
      score += Math.min(contentMatches * 2, 10);
    });
    
    // Bonus for matching multiple keywords
    const matchedKeywords = keywords.filter(k => 
      titleLower.includes(k) || contentLower.includes(k)
    ).length;
    score += matchedKeywords * 5;
    
    return { article, score };
  });
  
  return scored
    .filter(s => s.score >= 15) // Minimum score threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({ ...s.article, _score: s.score })); // Include score for filtering
}

// Search Zoho tickets
function searchTickets(query, limit = 3) {
  if (zohoTickets.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  
  // Filter out stop words and clean keywords
  const stopWords = new Set(['how', 'do', 'i', 'the', 'a', 'an', 'to', 'in', 'on', 'for', 'with', 'from', 'can', 'what', 'when', 'where', 'why', 'my', 'is', 'are', 'it', 'this', 'that', 'and', 'or', 'but']);
  const keywords = queryLower
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(k => k.length > 2 && !stopWords.has(k));
  
  if (keywords.length === 0) return [];
  
  const scored = zohoTickets.map(ticket => {
    const subjectLower = ticket.subject.toLowerCase();
    const descriptionLower = (ticket.description || '').toLowerCase();
    const resolutionLower = (ticket.resolution || '').toLowerCase();
    
    let score = 0;
    
    // Exact phrase match (very high score)
    if (subjectLower.includes(queryLower)) score += 100;
    if (descriptionLower.includes(queryLower)) score += 50;
    if (resolutionLower.includes(queryLower)) score += 60;
    
    // Keyword matches
    keywords.forEach(keyword => {
      if (subjectLower.includes(keyword)) {
        score += 20;
        if (subjectLower.startsWith(keyword)) score += 10;
      }
      
      const descMatches = (descriptionLower.match(new RegExp(keyword, 'g')) || []).length;
      score += Math.min(descMatches * 2, 10);
      
      const resMatches = (resolutionLower.match(new RegExp(keyword, 'g')) || []).length;
      score += Math.min(resMatches * 3, 15);
    });
    
    // Bonus for matching multiple keywords
    const matchedKeywords = keywords.filter(k => 
      subjectLower.includes(k) || descriptionLower.includes(k) || resolutionLower.includes(k)
    ).length;
    score += matchedKeywords * 5;
    
    // Prefer closed tickets with resolutions
    if (ticket.status === 'Closed' && ticket.resolution) {
      score += 5;
    }
    
    return { ticket, score };
  });
  
  return scored
    .filter(s => s.score >= 15) // Minimum score threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.ticket);
}

// Search mojosells.com pages
function searchMojosells(query, limit = 3) {
  if (mojosellsPages.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  
  // Filter out stop words and clean keywords
  const stopWords = new Set(['how', 'do', 'i', 'the', 'a', 'an', 'to', 'in', 'on', 'for', 'with', 'from', 'can', 'what', 'when', 'where', 'why', 'my', 'is', 'are', 'it', 'this', 'that', 'and', 'or', 'but']);
  const keywords = queryLower
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(k => k.length > 2 && !stopWords.has(k));
  
  if (keywords.length === 0) return [];
  
  const scored = mojosellsPages.map(page => {
    const titleLower = (page.title || '').toLowerCase();
    const contentLower = (page.content || '').toLowerCase();
    const urlLower = (page.url || '').toLowerCase();
    
    let score = 0;
    
    // Exact phrase match
    if (titleLower.includes(queryLower)) score += 100;
    if (contentLower.includes(queryLower)) score += 50;
    
    // Keyword matches
    keywords.forEach(keyword => {
      if (titleLower.includes(keyword)) {
        score += 20;
        if (titleLower.startsWith(keyword)) score += 10;
      }
      if (urlLower.includes(keyword)) score += 10;
      
      const contentMatches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
      score += Math.min(contentMatches * 2, 10);
    });
    
    // Bonus for matching multiple keywords
    const matchedKeywords = keywords.filter(k => 
      titleLower.includes(k) || contentLower.includes(k)
    ).length;
    score += matchedKeywords * 5;
    
    return { page, score };
  });
  
  return scored
    .filter(s => s.score >= 15) // Minimum score threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.page);
}

// Search corrections
function searchCorrections(query, limit = 3) {
  if (corrections.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  
  // Filter out stop words and clean keywords
  const stopWords = new Set(['how', 'do', 'i', 'the', 'a', 'an', 'to', 'in', 'on', 'for', 'with', 'from', 'can', 'what', 'when', 'where', 'why', 'my', 'is', 'are', 'it', 'this', 'that', 'and', 'or', 'but']);
  const keywords = queryLower
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(k => k.length > 2 && !stopWords.has(k));
  
  if (keywords.length === 0) return [];
  
  const scored = corrections.map(correction => {
    const questionLower = correction.question.toLowerCase();
    const correctionTextLower = correction.correction.toLowerCase();
    
    let score = 0;
    
    // Exact phrase match (very high score for corrections)
    if (questionLower.includes(queryLower)) score += 150;
    if (correctionTextLower.includes(queryLower)) score += 100;
    
    // Keyword matches
    keywords.forEach(keyword => {
      if (questionLower.includes(keyword)) {
        score += 30;
        if (questionLower.startsWith(keyword)) score += 15;
      }
      
      const correctionMatches = (correctionTextLower.match(new RegExp(keyword, 'g')) || []).length;
      score += Math.min(correctionMatches * 3, 15);
    });
    
    // Bonus for matching multiple keywords
    const matchedKeywords = keywords.filter(k => 
      questionLower.includes(k) || correctionTextLower.includes(k)
    ).length;
    score += matchedKeywords * 10;
    
    return { correction, score };
  });
  
  return scored
    .filter(s => s.score >= 20) // Minimum score threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.correction);
}

// Save correction
async function saveCorrection(correction) {
  corrections.push(correction);
  const dataPath = join(__dirname, '../data/corrections.json');
  await writeFile(dataPath, JSON.stringify(corrections, null, 2), 'utf8');
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
    },
    corrections: {
      loaded: correctionsLoaded,
      count: corrections.length
    }
  });
});

// Submit correction
app.post('/api/correction', async (req, res) => {
  try {
    const { question, aiResponse, correction, sessionId, messageIndex } = req.body;
    
    if (!question || !aiResponse || !correction) {
      return res.status(400).json({ error: 'Question, AI response, and correction are required' });
    }
    
    if (correction.length > 2000) {
      return res.status(400).json({ error: 'Correction too long (max 2000 characters)' });
    }
    
    const correctionEntry = {
      id: uuidv4(),
      question: question.trim(),
      aiResponse: aiResponse.trim(),
      correction: correction.trim(),
      sessionId: sessionId || null,
      messageIndex: messageIndex || null,
      timestamp: new Date().toISOString()
    };
    
    await saveCorrection(correctionEntry);
    
    console.log(`📝 Correction saved: "${question.substring(0, 50)}..."`);
    
    res.json({
      success: true,
      message: 'Thank you! Your correction has been saved and will help improve future responses.',
      correctionId: correctionEntry.id
    });
    
  } catch (error) {
    console.error('Correction submission error:', error);
    res.status(500).json({ error: 'Failed to save correction' });
  }
});

// Chat endpoint
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
    
    session.lastActivity = Date.now();
    
    // Detect pricing questions
    const isPricingQuestion = /\b(price|prices|pricing|cost|costs|how much|payment|payments|subscription|subscriptions|fee|fees|monthly|plan|plans)\b/i.test(message);
    
    // Search all data sources
    let kbResults = searchKB(message, 3);
    let ticketResults = searchTickets(message, 2);
    let mojosellsResults = searchMojosells(message, 2);
    let correctionResults = searchCorrections(message, 2);
    
    // For pricing questions, ONLY use mojosells.com (specifically pricing page)
    if (isPricingQuestion) {
      console.log('💰 Pricing question detected, filtering to pricing page only');
      // Filter to only include the pricing page
      mojosellsResults = mojosellsPages.filter(p => p.url.includes('/pricing'));
      // Clear other sources for pricing questions
      kbResults = [];
      ticketResults = [];
      console.log(`💰 Filtered sources: mojosells=${mojosellsResults.length}, kb=${kbResults.length}, tickets=${ticketResults.length}`);
    }
    
    // Build context from all sources
    let context = '';
    
    // CORRECTIONS FIRST - highest priority to avoid repeating mistakes
    if (correctionResults.length > 0) {
      context += '=== IMPORTANT: USER CORRECTIONS (Previous Mistakes to Avoid) ===\n\n';
      correctionResults.forEach((corr, i) => {
        context += `[CORRECTION-${i + 1}]\n`;
        context += `Previous Question: "${corr.question}"\n`;
        context += `Previous AI Response (INCORRECT): "${corr.aiResponse.substring(0, 300)}..."\n`;
        context += `CORRECT ANSWER: "${corr.correction}"\n`;
        context += `⚠️ Use this correction to provide accurate information.\n\n`;
      });
    }
    
    if (kbResults.length > 0) {
      context += '=== KNOWLEDGE BASE ARTICLES ===\n\n';
      kbResults.forEach((article, i) => {
        context += `[KB-${i + 1}] ${article.title}\n`;
        context += `Category: ${article.category || 'General'}\n`;
        context += `Content: ${article.content.substring(0, 800)}...\n`;
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
    
    // Build system prompt  
    const systemPrompt = `CRITICAL FIRST RULE: Do NOT start any response with "Based on" or "According to". Start directly with the answer.

You are Mojo Support - friendly, helpful, and knowledgeable. Answer like a warm, helpful colleague.

${correctionResults.length > 0 ? '⚠️ **CRITICAL**: User corrections are included below. These represent previous mistakes. Follow the corrected information EXACTLY to avoid repeating errors.' : ''}

${isPricingQuestion ? '**PRICING QUESTION DETECTED**: Answer using ONLY the mojosells.com pricing information below. All pricing information comes from the official pricing page.' : ''}

Tone examples:
✅ "Great question! Mojo Voice is an add-on service that costs $30/month..."
✅ "Happy to help! Here's how to import contacts:"
✅ "I'd be glad to explain that! Expired Data gives you..."
❌ "Based on the information provided..." ← NEVER START LIKE THIS

Never use: "based on", "according to", "knowledge base", "articles", "documentation"

If you don't have the info:
"I don't have details on that, but our support team can help! Call 877-859-6656 or email info@mojosells.com"

Use ONLY the information below. Format clearly: numbers, bullets, **bold**.

${context}`;
    
    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      temperature: 0.4, // Balanced temperature - not too rigid, not too creative
      system: systemPrompt,
      messages: session.messages.slice(-10) // Last 10 messages for context
    });
    
    const assistantMessage = response.content[0].text;
    
    // Add assistant response to session
    session.messages.push({
      role: 'assistant',
      content: assistantMessage
    });
    
    // Prepare response with sources used
    const sourcesUsed = {
      corrections: correctionResults.map(c => ({ 
        question: c.question, 
        correction: c.correction.substring(0, 200) + (c.correction.length > 200 ? '...' : ''),
        timestamp: c.timestamp 
      })),
      kb: kbResults.map(a => ({ title: a.title, url: a.url, category: a.category })),
      tickets: ticketResults.map(t => ({ subject: t.subject, status: t.status })),
      mojosells: mojosellsResults.map(p => ({ title: p.title, url: p.url }))
    };
    
    // Only show highly relevant articles (score >= 40) in "Related Articles"
    const relevantArticles = kbResults
      .filter(a => a._score >= 40)
      .map(a => ({ title: a.title, url: a.url }));
    
    // Add message index for correction tracking
    const messageIndex = session.messages.length - 1;
    
    res.json({
      response: assistantMessage,
      sessionId: sid,
      messageIndex,
      sourcesUsed,
      articlesUsed: relevantArticles // For backwards compatibility
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
    console.log(`   User Corrections: ${correctionsLoaded ? '✅' : '⚠️ '} (${corrections.length})`);
    console.log(`\nReady to serve! 🎉\n`);
  });
}

start().catch(console.error);
