#!/usr/bin/env node
import { readFile, writeFile, appendFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_URL = 'http://localhost:3456/api/chat';
const INPUT_CSV = join(__dirname, '../ticket-bot-responses-final.csv');
const OUTPUT_CSV = join(__dirname, '../ticket-bot-complete.csv');
const TICKETS_FILE = join(__dirname, '../data/zoho-tickets.json');

async function callWithRetry(query, maxRetries = 5) {
  let delay = 20000; // Start with 20 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return { success: true, response: data.response, sourcesUsed: data.sourcesUsed };
    } catch (err) {
      console.log(`    Attempt ${attempt} failed: ${err.message}. Waiting ${delay/1000}s...`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delay));
        delay += 10000; // Add 10 seconds each retry
      } else {
        return { success: false, error: err.message };
      }
    }
  }
}

function escapeCSV(str) {
  if (!str) return '';
  let cleaned = str.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/\s+/g, ' ').trim().replace(/"/g, '""');
  return `"${cleaned}"`;
}

async function main() {
  // Read existing CSV and find failed ones
  const csvContent = await readFile(INPUT_CSV, 'utf-8');
  const lines = csvContent.split('\n');
  const header = lines[0];
  
  const failed = [];
  const succeeded = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    if (lines[i].includes('"fetch failed"') || lines[i].includes('"HTTP ')) {
      // Extract ticket number
      const match = lines[i].match(/^"(\d+)"/);
      if (match) failed.push({ ticketNumber: match[1], lineIndex: i });
    } else {
      succeeded.push(lines[i]);
    }
  }
  
  console.log(`Found ${failed.length} failed tickets to retry`);
  console.log(`Already succeeded: ${succeeded.length}\n`);
  
  if (failed.length === 0) {
    console.log('Nothing to retry!');
    return;
  }
  
  // Load tickets data
  const allTickets = JSON.parse(await readFile(TICKETS_FILE, 'utf-8'));
  const ticketMap = new Map(allTickets.map(t => [t.ticketNumber, t]));
  
  // Write header + succeeded rows
  await writeFile(OUTPUT_CSV, header + '\n' + succeeded.join('\n') + '\n');
  
  let done = 0, success = 0, errors = 0;
  
  for (const { ticketNumber } of failed) {
    done++;
    const ticket = ticketMap.get(ticketNumber);
    if (!ticket) {
      console.log(`[${done}/${failed.length}] Ticket ${ticketNumber} not found, skipping`);
      continue;
    }
    
    // Combine subject + description for full context
    const subject = ticket.subject || '';
    const desc = (ticket.description || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').substring(0, 500);
    const query = subject && desc ? `${subject}: ${desc}` : (subject || desc || 'General inquiry');
    console.log(`[${done}/${failed.length}] #${ticketNumber}: ${query.substring(0, 50)}...`);
    
    const result = await callWithRetry(query);
    
    const row = [
      escapeCSV(ticket.ticketNumber),
      escapeCSV(ticket.subject),
      escapeCSV(ticket.description?.substring(0, 300)),
      escapeCSV(ticket.createdTime),
      escapeCSV(ticket.status),
      escapeCSV(result.response),
      result.sourcesUsed?.kb?.length || 0,
      result.sourcesUsed?.tickets?.length || 0,
      escapeCSV(result.success ? '' : result.error)
    ].join(',');
    
    await appendFile(OUTPUT_CSV, row + '\n');
    
    if (result.success) {
      success++;
      console.log(`    ✅ Success`);
    } else {
      errors++;
      console.log(`    ❌ Failed after all retries: ${result.error}`);
    }
    
    // Small delay between successful requests
    if (result.success) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  console.log(`\n✅ Complete!`);
  console.log(`   Retried: ${done}`);
  console.log(`   Success: ${success}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total in file: ${succeeded.length + success + errors}`);
  console.log(`   Output: ${OUTPUT_CSV}`);
}

main().catch(console.error);
