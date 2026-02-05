#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, mkdir } from 'fs/promises';
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

// Videos to process (newest first)
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

// Ensure work directory exists
async function setup() {
  if (!existsSync(WORK_DIR)) {
    await mkdir(WORK_DIR, { recursive: true });
  }
  console.log(`📁 Working directory: ${WORK_DIR}\n`);
}

// Download video
async function downloadVideo(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(WORK_DIR, `${videoId}.mp4`);
  
  if (existsSync(outputPath)) {
    console.log(`  ✓ Video already downloaded`);
    return outputPath;
  }
  
  console.log(`  ⬇️  Downloading video...`);
  const ytdlp = '/tmp/yt-dlp';
  // Try with extractor args to avoid bot detection
  await execAsync(`${ytdlp} --extractor-args "youtube:player_client=android" -f "best[height<=720]" -o "${outputPath}" "${url}"`);
  console.log(`  ✓ Downloaded`);
  return outputPath;
}

// Extract audio
async function extractAudio(videoPath, videoId) {
  const audioPath = path.join(WORK_DIR, `${videoId}.wav`);
  
  if (existsSync(audioPath)) {
    console.log(`  ✓ Audio already extracted`);
    return audioPath;
  }
  
  console.log(`  🎵 Extracting audio...`);
  await execAsync(`ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y 2>/dev/null`);
  console.log(`  ✓ Audio extracted`);
  return audioPath;
}

// Transcribe with OpenAI Whisper API
async function transcribeAudio(audioPath, videoId) {
  const transcriptPath = path.join(WORK_DIR, `${videoId}.transcript.json`);
  
  if (existsSync(transcriptPath)) {
    console.log(`  ✓ Transcript already exists`);
    const data = await readFile(transcriptPath, 'utf8');
    return JSON.parse(data);
  }
  
  console.log(`  🎤 Transcribing with Whisper API...`);
  
  // Use curl to call OpenAI Whisper API (node fetch FormData is problematic)
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
  console.log(`  ✓ Transcribed (${result.segments?.length || 0} segments)`);
  return result;
}

// Extract keyframes (every 10 seconds)
async function extractFrames(videoPath, videoId) {
  const framesDir = path.join(WORK_DIR, `${videoId}_frames`);
  
  if (existsSync(framesDir)) {
    console.log(`  ✓ Frames already extracted`);
    return framesDir;
  }
  
  await mkdir(framesDir, { recursive: true });
  console.log(`  🖼️  Extracting keyframes (every 10s)...`);
  
  // Extract 1 frame every 10 seconds
  await execAsync(`ffmpeg -i "${videoPath}" -vf "fps=1/10" "${framesDir}/frame_%04d.png" -y 2>/dev/null`);
  
  const { stdout } = await execAsync(`ls "${framesDir}" | wc -l`);
  const count = parseInt(stdout.trim());
  console.log(`  ✓ Extracted ${count} frames`);
  return framesDir;
}

// Describe frame with Claude vision
async function describeFrame(framePath, timestamp) {
  const imageData = await readFile(framePath);
  const base64Image = imageData.toString('base64');
  
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 300,
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
          text: 'Describe what is visible on screen in this Mojo Dialer software screenshot. Focus on UI elements, buttons, menus, data visible, and any actions being shown. Be concise (1-2 sentences).'
        }
      ]
    }]
  });
  
  return response.content[0].text;
}

// Process all frames for a video
async function processFrames(framesDir, videoId) {
  const descriptionsPath = path.join(WORK_DIR, `${videoId}.frames.json`);
  
  if (existsSync(descriptionsPath)) {
    console.log(`  ✓ Frame descriptions already exist`);
    const data = await readFile(descriptionsPath, 'utf8');
    return JSON.parse(data);
  }
  
  console.log(`  👁️  Describing frames with Claude vision...`);
  
  const { stdout } = await execAsync(`ls "${framesDir}"`);
  const frames = stdout.trim().split('\n').filter(f => f.endsWith('.png')).sort();
  
  const descriptions = [];
  
  for (let i = 0; i < frames.length; i++) {
    const framePath = path.join(framesDir, frames[i]);
    const timestamp = i * 10; // 10 seconds per frame
    
    try {
      const description = await describeFrame(framePath, timestamp);
      descriptions.push({ timestamp, frame: frames[i], description });
      process.stdout.write(`    Frame ${i + 1}/${frames.length}... ✓\n`);
    } catch (error) {
      console.error(`    Frame ${i + 1} failed:`, error.message);
    }
    
    // Rate limit: wait 1 second between API calls
    if (i < frames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  await writeFile(descriptionsPath, JSON.stringify(descriptions, null, 2));
  console.log(`  ✓ Described ${descriptions.length} frames`);
  return descriptions;
}

// Merge transcript and frame descriptions into segments
function mergeSegments(transcript, frameDescriptions) {
  const segments = [];
  
  if (!transcript.segments || transcript.segments.length === 0) {
    return segments;
  }
  
  for (const segment of transcript.segments) {
    const startTime = Math.floor(segment.start);
    const endTime = Math.ceil(segment.end);
    
    // Find nearest frame description
    let nearestFrame = frameDescriptions[0];
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

// Process a single video
async function processVideo(video) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📹 Processing: ${video.title}`);
  console.log(`   ID: ${video.id}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    const videoPath = await downloadVideo(video.id);
    const audioPath = await extractAudio(videoPath, video.id);
    const transcript = await transcribeAudio(audioPath, video.id);
    const framesDir = await extractFrames(videoPath, video.id);
    const frameDescriptions = await processFrames(framesDir, video.id);
    
    // Get video duration
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
    
    console.log(`\n✅ Completed: ${segments.length} segments created\n`);
    return result;
    
  } catch (error) {
    console.error(`\n❌ Error processing video:`, error.message);
    return null;
  }
}

// Main
async function main() {
  console.log('🎬 Mojo Video Processing Pipeline\n');
  
  await setup();
  
  const results = [];
  
  for (const video of VIDEOS) {
    const result = await processVideo(video);
    if (result) {
      results.push(result);
    }
  }
  
  // Save results
  await writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2));
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Pipeline complete!`);
  console.log(`   Processed: ${results.length}/${VIDEOS.length} videos`);
  console.log(`   Output: ${OUTPUT_FILE}`);
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(console.error);
