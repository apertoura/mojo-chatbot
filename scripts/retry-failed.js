#!/usr/bin/env node
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_URL = 'http://localhost:3456/api/chat';
const INPUT_PATH = join(__dirname, '../ticket-bot-responses.csv');
const OUTPUT_PATH = join(__dirname, '../ticket-bot-responses-final.csv');
const DELAY_MS = 5000; // 5 seconds between retries

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
  let cleaned = str.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/"/g, '""');
  return `"${cleaned}"`;
}

// Simple CSV parser
function parseCSV(content) {
  const lines = content.split('\n');
  const header = lines[0];
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    records.push({ line: lines[i], index: i });
  }
  return { header, records };
}

async function main() {
  console.log('Loading existing results...');
  const csvContent = await readFile(INPUT_PATH, 'utf-8');
  const { header, records } = parseCSV(csvContent);
  
  // Find failed ones (error column is last, not empty)
  const failed = records.filter(r => {
    const lastComma = r.line.lastIndexOf(',');
    const errorField = r.line.substring(lastComma + 1).trim();
    return errorField !== '' && errorField !== '""';
  });
  
  const succeeded = records.filter(r => {
    const lastComma = r.line.lastIndexOf(',');
    const errorField = r.line.substring(lastComma + 1).trim();
    return errorField === '' || errorField === '""';
  });
  
  console.log(`Total: ${records.length} | Success: ${succeeded.length} | Failed: ${failed.length}`);
  
  if (failed.length === 0) {
    console.log('No failed records to retry!');
    return;
  }
  
  console.log(`Retrying ${failed.length} failed tickets with ${DELAY_MS/1000}s delays...`);
  console.log(`Estimated time: ${Math.ceil(failed.length * DELAY_MS / 60000)} minutes\n`);
  
  let retried = 0;
  let newSuccess = 0;
  const updatedLines = new Map();
  
  for (const record of failed) {
    retried++;
    
    // Extract subject (second field)
    const match = record.line.match(/^"([^"]*)",\s*"([^"]*)"/);
    const subject = match ? match[2] : 'General inquiry';
    
    console.log(`[${retried}/${failed.length}] Retrying: ${subject.substring(0, 50)}...`);
    
    const result = await callMojoBot(subject);
    
    if (result.error) {
      console.log(`  ❌ Still failed: ${result.error}`);
    } else {
      newSuccess++;
      // Rebuild the line with new response
      const parts = record.line.split('","');
      if (parts.length >= 6) {
        parts[5] = escapeCSV(result.response).slice(1, -1); // Remove outer quotes
        parts[6] = String(result.sourcesUsed?.kb?.length || 0);
        parts[7] = String(result.sourcesUsed?.tickets?.length || 0);
        parts[8] = ''; // Clear error
        updatedLines.set(record.index, parts.join('","'));
      }
      console.log(`  ✅ Success!`);
    }
    
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  
  // Rebuild CSV
  const outputLines = [header];
  for (let i = 1; i < csvContent.split('\n').length; i++) {
    const line = csvContent.split('\n')[i];
    if (!line.trim()) continue;
    outputLines.push(updatedLines.get(i) || line);
  }
  
  await writeFile(OUTPUT_PATH, outputLines.join('\n'));
  
  console.log(`\n✅ Done!`);
  console.log(`   Previously succeeded: ${succeeded.length}`);
  console.log(`   Newly succeeded: ${newSuccess}`);
  console.log(`   Still failed: ${failed.length - newSuccess}`);
  console.log(`   Total success: ${succeeded.length + newSuccess}/${records.length}`);
  console.log(`   Output: ${OUTPUT_PATH}`);
}

main().catch(console.error);
