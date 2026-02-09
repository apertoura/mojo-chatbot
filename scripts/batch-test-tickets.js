#!/usr/bin/env node
import { readFile, writeFile, appendFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_URL = 'http://localhost:3456/api/chat';
const ONE_WEEK_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const OUTPUT_PATH = join(__dirname, '../ticket-bot-responses.csv');
const DELAY_MS = 15000; // 15 seconds between requests to avoid rate limits

async function callMojoBot(query) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return {
      response: data.response,
      sourcesUsed: data.sourcesUsed
    };
  } catch (err) {
    return { error: err.message };
  }
}

function escapeCSV(str) {
  if (!str) return '';
  // Strip HTML tags
  let cleaned = str.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  // Clean whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // Escape quotes
  cleaned = cleaned.replace(/"/g, '""');
  return `"${cleaned}"`;
}

async function main() {
  console.log('Loading tickets...');
  const ticketsData = await readFile(join(__dirname, '../data/zoho-tickets.json'), 'utf-8');
  const allTickets = JSON.parse(ticketsData);
  
  // Filter last week's tickets
  const recentTickets = allTickets.filter(t => 
    t.createdTime >= ONE_WEEK_AGO && 
    (t.subject || t.description)
  );
  
  const total = recentTickets.length;
  console.log(`Found ${total} tickets from last week`);
  console.log(`Estimated time: ${Math.ceil(total * DELAY_MS / 60000)} minutes`);
  console.log('');
  
  // Write header
  await writeFile(OUTPUT_PATH, 'ticketNumber,subject,description,createdTime,status,botResponse,kbSourcesCount,ticketSourcesCount,error\n');
  
  let processed = 0;
  let errors = 0;
  const startTime = Date.now();
  
  for (const ticket of recentTickets) {
    processed++;
    
    // Use subject as query, fall back to description
    // Combine subject + description for full context
    const subject = ticket.subject || '';
    const desc = (ticket.description || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').substring(0, 500);
    const query = subject && desc ? `${subject}: ${desc}` : (subject || desc || 'General inquiry');
    
    // Progress update every 10 tickets
    if (processed % 10 === 1 || processed === total) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = (total - processed) / rate;
      console.log(`[${processed}/${total}] ${Math.round(processed/total*100)}% | Errors: ${errors} | ETA: ${Math.ceil(remaining/60)}min`);
    }
    
    const result = await callMojoBot(query);
    
    if (result.error) {
      errors++;
      console.log(`  ⚠️ Error on ticket ${ticket.ticketNumber}: ${result.error}`);
    }
    
    const row = [
      escapeCSV(ticket.ticketNumber),
      escapeCSV(ticket.subject),
      escapeCSV(ticket.description?.substring(0, 300)),
      escapeCSV(ticket.createdTime),
      escapeCSV(ticket.status),
      escapeCSV(result.response),
      result.sourcesUsed?.kb?.length || 0,
      result.sourcesUsed?.tickets?.length || 0,
      escapeCSV(result.error || '')
    ].join(',');
    
    // Append each row immediately (incremental save)
    await appendFile(OUTPUT_PATH, row + '\n');
    
    // Rate limit delay
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log('');
  console.log(`✅ Done! Processed ${total} tickets in ${Math.floor(totalTime/60)}m ${totalTime%60}s`);
  console.log(`   Success: ${total - errors} | Errors: ${errors}`);
  console.log(`   Output: ${OUTPUT_PATH}`);
}

main().catch(console.error);
