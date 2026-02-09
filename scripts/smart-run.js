#!/usr/bin/env node
import { readFile, writeFile, appendFile, stat } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_URL = 'http://localhost:3456/api/chat';
const INPUT_CSV = join(__dirname, '../ticket-bot-filtered.csv');
const OUTPUT_CSV = join(__dirname, '../ticket-bot-smart-output.csv');
const TICKETS_FILE = join(__dirname, '../data/zoho-tickets.json');

// Rate limit detection patterns
const RATE_LIMIT_PATTERNS = ['rate limit', '429', 'too many requests', 'quota exceeded'];

async function callBot(query) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (response.status === 429) {
      return { rateLimit: true, error: 'HTTP 429 Rate Limited' };
    }
    
    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    // Check for rate limit in response
    const respLower = (data.response || '').toLowerCase();
    if (RATE_LIMIT_PATTERNS.some(p => respLower.includes(p))) {
      return { rateLimit: true, error: 'Rate limit detected in response' };
    }
    
    return { success: true, response: data.response, sourcesUsed: data.sourcesUsed };
  } catch (err) {
    const errMsg = err.message.toLowerCase();
    if (RATE_LIMIT_PATTERNS.some(p => errMsg.includes(p))) {
      return { rateLimit: true, error: err.message };
    }
    return { error: err.message };
  }
}

function escapeCSV(str) {
  if (!str) return '';
  let cleaned = str.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/\s+/g, ' ').trim().replace(/"/g, '""');
  return `"${cleaned}"`;
}

async function verifyWrite(expectedLines) {
  try {
    const content = await readFile(OUTPUT_CSV, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim()).length;
    return lines === expectedLines;
  } catch {
    return false;
  }
}

async function main() {
  // Load tickets data
  const allTickets = JSON.parse(await readFile(TICKETS_FILE, 'utf-8'));
  const ticketMap = new Map(allTickets.map(t => [t.ticketNumber, t]));
  
  // Read filtered CSV to get the ticket numbers (skip header)
  const csvContent = await readFile(INPUT_CSV, 'utf-8');
  const lines = csvContent.split('\n').filter(l => l.trim());
  const header = lines[0];
  
  const ticketNumbers = [];
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/^"(\d+)"/);
    if (match) ticketNumbers.push(match[1]);
  }
  
  console.log(`📊 Total tickets to process: ${ticketNumbers.length}`);
  console.log(`🎯 Output: ${OUTPUT_CSV}`);
  console.log(`⏱️  Starting...\n`);
  
  // Write header
  await writeFile(OUTPUT_CSV, header + '\n');
  
  let processed = 0;
  let success = 0;
  let errors = 0;
  let rateLimitWaits = 0;
  
  for (const ticketNumber of ticketNumbers) {
    processed++;
    const ticket = ticketMap.get(ticketNumber);
    
    if (!ticket) {
      console.log(`[${processed}/${ticketNumbers.length}] ⚠️ Ticket ${ticketNumber} not found, skipping`);
      continue;
    }
    
    // Build query: "Subject: Description..."
    const subject = ticket.subject || '';
    const desc = (ticket.description || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').substring(0, 500).trim();
    const query = subject && desc ? `${subject}: ${desc}` : (subject || desc || 'General inquiry');
    
    console.log(`[${processed}/${ticketNumbers.length}] #${ticketNumber}: ${query.substring(0, 60)}...`);
    
    let result;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      attempts++;
      result = await callBot(query);
      
      if (result.rateLimit) {
        rateLimitWaits++;
        const waitTime = 30 + (attempts * 15); // Increasing backoff
        console.log(`   ⏳ Rate limit hit (attempt ${attempts}). Waiting ${waitTime}s...`);
        await new Promise(r => setTimeout(r, waitTime * 1000));
        continue;
      }
      
      break; // Success or non-rate-limit error
    }
    
    if (result.rateLimit) {
      console.log(`   🛑 PAUSED: Rate limit persists after ${maxAttempts} attempts.`);
      console.log(`   Progress: ${processed-1}/${ticketNumbers.length} complete`);
      process.exit(1);
    }
    
    if (result.error && !result.success) {
      errors++;
      console.log(`   🛑 PAUSED: Error - ${result.error}`);
      console.log(`   This is NOT a rate limit. Manual review needed.`);
      console.log(`   Progress: ${processed-1}/${ticketNumbers.length} complete`);
      process.exit(2);
    }
    
    // Build and write row
    const row = [
      escapeCSV(ticket.ticketNumber),
      escapeCSV(ticket.subject),
      escapeCSV(ticket.description?.substring(0, 300)),
      escapeCSV(ticket.createdTime),
      escapeCSV(ticket.status),
      escapeCSV(result.response),
      result.sourcesUsed?.kb?.length || 0,
      result.sourcesUsed?.tickets?.length || 0,
      ''
    ].join(',');
    
    await appendFile(OUTPUT_CSV, row + '\n');
    
    // Verify write
    const expectedLines = processed + 1; // header + processed rows
    const writeOK = await verifyWrite(expectedLines);
    
    if (!writeOK) {
      console.log(`   🛑 PAUSED: Write verification failed!`);
      console.log(`   Expected ${expectedLines} lines in output but verification failed.`);
      process.exit(3);
    }
    
    success++;
    console.log(`   ✅ Done (${result.sourcesUsed?.kb?.length || 0} KB, ${result.sourcesUsed?.tickets?.length || 0} tickets)`);
    
    // Progress update every 10
    if (processed % 10 === 0) {
      console.log(`\n📈 Progress: ${processed}/${ticketNumbers.length} (${Math.round(processed/ticketNumbers.length*100)}%) | ✅ ${success} | ⏳ Rate waits: ${rateLimitWaits}\n`);
    }
    
    // Brief delay between requests
    await new Promise(r => setTimeout(r, 5000));
  }
  
  console.log(`\n🎉 COMPLETE!`);
  console.log(`   Total: ${ticketNumbers.length}`);
  console.log(`   Success: ${success}`);
  console.log(`   Rate limit waits: ${rateLimitWaits}`);
  console.log(`   Output: ${OUTPUT_CSV}`);
}

main().catch(err => {
  console.log(`\n💥 FATAL ERROR: ${err.message}`);
  process.exit(99);
});
