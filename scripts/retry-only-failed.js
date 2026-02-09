#!/usr/bin/env node
import { readFile, writeFile, appendFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_URL = 'http://localhost:3456/api/chat';
const DELAY_MS = 15000; // 15 seconds
const FAILED_FILE = '/tmp/failed-tickets.txt';
const TICKETS_FILE = join(__dirname, '../data/zoho-tickets.json');
const OUTPUT_FILE = join(__dirname, '../ticket-bot-retried.csv');

async function callMojoBot(query) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) return { error: `HTTP ${response.status}` };
    
    const data = await response.json();
    return { response: data.response, sourcesUsed: data.sourcesUsed };
  } catch (err) {
    return { error: err.message };
  }
}

function escapeCSV(str) {
  if (!str) return '';
  let cleaned = str.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/\s+/g, ' ').trim().replace(/"/g, '""');
  return `"${cleaned}"`;
}

async function main() {
  const failedNumbers = (await readFile(FAILED_FILE, 'utf-8')).trim().split('\n');
  const allTickets = JSON.parse(await readFile(TICKETS_FILE, 'utf-8'));
  
  const failedTickets = allTickets.filter(t => failedNumbers.includes(t.ticketNumber));
  
  console.log(`Retrying ${failedTickets.length} failed tickets with ${DELAY_MS/1000}s delays`);
  console.log(`Estimated time: ${Math.ceil(failedTickets.length * DELAY_MS / 60000)} minutes\n`);
  
  await writeFile(OUTPUT_FILE, 'ticketNumber,subject,description,createdTime,status,botResponse,kbSourcesCount,ticketSourcesCount,error\n');
  
  let done = 0, success = 0, errors = 0;
  
  for (const ticket of failedTickets) {
    done++;
    const query = ticket.subject || ticket.description?.substring(0, 500) || 'General inquiry';
    
    if (done % 5 === 1) {
      const remaining = (failedTickets.length - done) * DELAY_MS / 60000;
      console.log(`[${done}/${failedTickets.length}] ${Math.round(done/failedTickets.length*100)}% | S:${success} E:${errors} | ETA: ${Math.ceil(remaining)}min`);
    }
    
    const result = await callMojoBot(query);
    
    if (result.error) {
      errors++;
      console.log(`  ⚠️ ${ticket.ticketNumber}: ${result.error}`);
    } else {
      success++;
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
    
    await appendFile(OUTPUT_FILE, row + '\n');
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  
  console.log(`\n✅ Done! Success: ${success}/${failedTickets.length} | Errors: ${errors}`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
