import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function askClaude(prompt) {
  try {
    // Create a temporary file with the prompt
    const tempFile = `/tmp/mojo-prompt-${Date.now()}.txt`;
    await execAsync(`echo ${JSON.stringify(prompt)} > ${tempFile}`);
    
    // Use clawdbot to process it
    const { stdout } = await execAsync(
      `cat ${tempFile} | clawdbot chat --model anthropic/claude-sonnet-4-5 --thinking off`,
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
    );
    
    // Clean up
    await execAsync(`rm -f ${tempFile}`);
    
    return stdout.trim();
  } catch (error) {
    console.error('Claude proxy error:', error);
    throw new Error('Failed to get response from Claude');
  }
}
