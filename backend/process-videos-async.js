#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, mkdir, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(exec);

const WORK_DIR = path.join(__dirname, '../video-processing');
const OUTPUT_FILE = path.join(__dirname, '../data/video-walkthroughs.json');
const LOG_FILE = path.join(__dirname, '../video-processing.log');

// Videos to process
const VIDEOS = [
  { id: 'zOqFGO5TJk4', title: 'Real Estate Cold Calling Tips', age: '12 days' },
  { id: 'ua13AQZZ_rI', title: 'FSBO Lead Prospecting Advice and Tips', age: '12 days' },
  { id: '36d4RJLHWpY', title: 'Expired Property Prospecting Tips and Advice', age: '12 days' },
  { id: 'LNrrRUtlC1Q', title: 'Mojo Dialer Demonstration Video', age: '1 month' },
  { id: '454KS_Gi3NE', title: 'Knock on More Doors with Mojo Door Knocker App', age: '1 year' },
  { id: 'UshnfVFdnGc', title: 'Take Your Mojo on the Go', age: '1 year' },
  { id: '237Qy_FCrTY', title: 'Unlock the Power of Precision with Mojo Skip Tracer', age: '1 year' },
  { id: 'WIfMR4KIrQw', title: 'Discover the Power of Mojo Neighborhood Search', age: '1 year' },
  { id: 'qDuSPzx2qIw', title: 'Mojo Dialer and Lead Services Overview', age: '1 year' }
];

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Logging
async function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(logLine.trim());
  await appendFile(LOG_FILE, logLine).catch(() => {});
}

// Setup
async function setup() {
  if (!existsSync(WORK_DIR)) {
    await mkdir(WORK_DIR, { recursive: true });
  }
  await log(`Working directory: ${WORK_DIR}`);
}

// Download video
async function downloadVideo(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(WORK_DIR, `${videoId}.mp4`);
  
  if (existsSync(outputPath)) {
    await log(`  ✓ Video already downloaded`);
    return outputPath;
  }
  
  await log(`  ⬇️  Downloading video...`);
  // Use yt-dlp with android client to avoid bot detection
  await execAsync(`/tmp/yt-dlp --extractor-args "youtube:player_client=android" -f "best[height<=720]" -o "${outputPath}" "${url}"`);
  await log(`  ✓ Downloaded`);
  return outputPath;
}

// Extract audio
async function extractAudio(videoPath, videoId) {
  const audioPath = path.join(WORK_DIR, `${videoId}.wav`);
  
  if (existsSync(audioPath)) {
    await log(`  ✓ Audio already extracted`);
    return audioPath;
  }
  
  await log(`  🎵 Extracting audio...`);
  await execAsync(`ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y 2>/dev/null`);
  await log(`  ✓ Audio extracted`);
  return audioPath;
}

// Transcribe with Whisper
async function transcribeAudio(audioPath, videoId) {
  const transcriptPath = path.join(WORK_DIR, `${videoId}.transcript.json`);
  
  if (existsSync(transcriptPath)) {
    await log(`  ✓ Transcript already exists`);
    const data = await readFile(transcriptPath, 'utf8');
    return JSON.parse(data);
  }
  
  await log(`  🎤 Transcribing with Whisper API...`);
  
  const cmd = `curl -s https://api.openai.com/v1/audio/transcriptions \
    -H "Authorization: Bearer ${process.env.OPENAI_API_KEY}" \
    -H "Content-Type: multipart/form-data" \
    -F file="@${audioPath}" \
    -F model="whisper-1" \
    -F response_format="verbose_json" \
    -F timestamp_granularities[]="segment"`;
  
  const { stdout } = await execAsync(cmd);
  const result = JSON.parse(stdout);
  
  await writeFile(transcriptPath, JSON.stringify(result, null, 2));
  await log(`  ✓ Transcribed (${result.segments?.length || 0} segments)`);
  return result;
}

// Extract keyframes (every 30 seconds for cost savings)
async function extractFrames(videoPath, videoId) {
  const framesDir = path.join(WORK_DIR, `${videoId}_frames`);
  
  if (existsSync(framesDir)) {
    await log(`  ✓ Frames already extracted`);
    return framesDir;
  }
  
  await mkdir(framesDir, { recursive: true });
  await log(`  🖼️  Extracting keyframes (every 30s)...`);
  
  // Extract 1 frame every 30 seconds (cheaper!)
  await execAsync(`ffmpeg -i "${videoPath}" -vf "fps=1/30" "${framesDir}/frame_%04d.png" -y 2>/dev/null`);
  
  const { stdout } = await execAsync(`ls "${framesDir}" | wc -l`);
  const count = parseInt(stdout.trim());
  await log(`  ✓ Extracted ${count} frames`);
  return framesDir;
}

// Describe frame with Claude Haiku (cheaper!)
async function describeFrame(framePath, timestamp) {
  const imageData = await readFile(framePath);
  const base64Image = imageData.toString('base64');
  
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307', // Cheaper model!
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: base64Image
          }
        },
        {
          type: 'text',
          text: 'Briefly describe what UI elements and actions are visible in this Mojo software screenshot (1-2 sentences).'
        }
      ]
    }]
  });
  
  return response.content[0].text;
}

// Process frames
async function processFrames(framesDir, videoId) {
  const descriptionsPath = path.join(WORK_DIR, `${videoId}.frames.json`);
  
  if (existsSync(descriptionsPath)) {
    await log(`  ✓ Frame descriptions already exist`);
    const data = await readFile(descriptionsPath, 'utf8');
    return JSON.parse(data);
  }
  
  await log(`  👁️  Describing frames with Claude Haiku...`);
  
  const { stdout } = await execAsync(`ls "${framesDir}"`);
  const frames = stdout.trim().split('\n').filter(f => f.endsWith('.png')).sort();
  
  const descriptions = [];
  
  for (let i = 0; i < frames.length; i++) {
    const framePath = path.join(framesDir, frames[i]);
    const timestamp = i * 30; // 30 seconds per frame
    
    try {
      const description = await describeFrame(framePath, timestamp);
      descriptions.push({ timestamp, frame: frames[i], description });
      await log(`    Frame ${i + 1}/${frames.length} ✓`);
    } catch (error) {
      await log(`    Frame ${i + 1} failed: ${error.message}`);
    }
    
    // Rate limit: 2 seconds between calls
    if (i < frames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  await writeFile(descriptionsPath, JSON.stringify(descriptions, null, 2));
  await log(`  ✓ Described ${descriptions.length} frames`);
  return descriptions;
}

// Merge transcript and frames
function mergeSegments(transcript, frameDescriptions) {
  const segments = [];
  
  if (!transcript.segments || transcript.segments.length === 0) {
    return segments;
  }
  
  for (const segment of transcript.segments) {
    const startTime = Math.floor(segment.start);
    const endTime = Math.ceil(segment.end);
    
    // Find nearest frame
    let nearestFrame = frameDescriptions[0] || { description: 'No visual data available' };
    let minDiff = Math.abs(startTime - nearestFrame.timestamp);
    
    for (const frame of frameDescriptions) {
      const diff = Math.abs(startTime - frame.timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        nearestFrame = frame;
      }
    }
    
    segments.push({
      timestamp: `${formatTime(startTime)}-${formatTime(endTime)}`,
      start: startTime,
      end: endTime,
      transcript: segment.text.trim(),
      screenContent: nearestFrame.description
    });
  }
  
  return segments;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Process single video
async function processVideo(video) {
  await log(`\n${'='.repeat(60)}`);
  await log(`📹 Processing: ${video.title}`);
  await log(`   ID: ${video.id}`);
  await log(`${'='.repeat(60)}\n`);
  
  try {
    const videoPath = await downloadVideo(video.id);
    const audioPath = await extractAudio(videoPath, video.id);
    const transcript = await transcribeAudio(audioPath, video.id);
    const framesDir = await extractFrames(videoPath, video.id);
    const frameDescriptions = await processFrames(framesDir, video.id);
    
    // Get duration
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`);
    const duration = Math.round(parseFloat(stdout.trim()));
    
    const segments = mergeSegments(transcript, frameDescriptions);
    
    const result = {
      id: video.id,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      title: video.title,
      age: video.age,
      duration,
      processedAt: new Date().toISOString(),
      segments
    };
    
    await log(`\n✅ Completed: ${segments.length} segments created\n`);
    return result;
    
  } catch (error) {
    await log(`\n❌ Error: ${error.message}\n`);
    return null;
  }
}

// Main
async function main() {
  await log('🎬 Mojo Video Processing Pipeline (Async/Overnight Mode)\n');
  await setup();
  
  const results = [];
  
  for (const video of VIDEOS) {
    const result = await processVideo(video);
    if (result) {
      results.push(result);
      // Save incrementally
      await writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2));
      await log(`💾 Saved progress: ${results.length}/${VIDEOS.length} videos\n`);
    }
  }
  
  await log(`\n${'='.repeat(60)}`);
  await log(`✅ Pipeline complete!`);
  await log(`   Processed: ${results.length}/${VIDEOS.length} videos`);
  await log(`   Output: ${OUTPUT_FILE}`);
  await log(`${'='.repeat(60)}\n`);
}

main().catch(async (error) => {
  await log(`FATAL ERROR: ${error.message}`);
  process.exit(1);
});
