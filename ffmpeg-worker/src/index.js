/**
 * FFmpeg Worker Example
 *
 * Demonstrates using the CLI tool binding to process video/audio files with ffmpeg.
 * Supports thumbnail generation, audio extraction, and format conversion.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers for browser testing
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'GET') {
      return new Response(getUsageInstructions(), {
        headers: { 'Content-Type': 'text/html', ...corsHeaders }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    try {
      const operation = url.searchParams.get('op') || 'thumbnail';
      
      // Get video data from request body
      const videoData = await request.arrayBuffer();
      if (videoData.byteLength === 0) {
        return new Response('No video data provided', { status: 400, headers: corsHeaders });
      }

      let result;
      
      switch (operation) {
        case 'thumbnail':
          result = await generateThumbnail(videoData, env);
          break;
        case 'audio':
          result = await extractAudio(videoData, env);
          break;
        case 'convert':
          const format = url.searchParams.get('format') || 'mp4';
          result = await convertVideo(videoData, format, env);
          break;
        default:
          return new Response('Unknown operation. Use ?op=thumbnail, ?op=audio, or ?op=convert', 
            { status: 400, headers: corsHeaders });
      }

      // Return the processed file
      return new Response(result.data, {
        headers: {
          'Content-Type': result.mimeType,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
          ...corsHeaders
        }
      });

    } catch (error) {
      console.error('FFmpeg operation failed:', error);
      return new Response(`Error: ${error.message}`, { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};

async function generateThumbnail(videoData, env) {
  const timestamp = "00:00:01";
  const width = 320;
  
  // Use ffmpeg to extract thumbnail
  const result = await env.CLI_TOOL.execute('ffmpeg', [
    '-i', 'stdin',
    '-ss', timestamp,
    '-vframes', '1',
    '-vf', `scale=${width}:-1`,
    '-f', 'image2',
    '-c:v', 'mjpeg',
    'pipe:1'
  ], {
    stdin: new Uint8Array(videoData)
  });

  if (result.exitCode !== 0) {
    throw new Error(`FFmpeg failed: ${result.stderr}`);
  }

  return {
    data: result.stdout,
    mimeType: 'image/jpeg',
    filename: 'thumbnail.jpg'
  };
}

async function extractAudio(videoData, env) {
  const format = 'mp3';
  const bitrate = '192k';
  
  // Extract audio track
  const result = await env.CLI_TOOL.execute('ffmpeg', [
    '-i', 'stdin',
    '-vn',
    '-acodec', 'libmp3lame',
    '-b:a', bitrate,
    '-f', format,
    'pipe:1'
  ], {
    stdin: new Uint8Array(videoData)
  });

  if (result.exitCode !== 0) {
    throw new Error(`FFmpeg failed: ${result.stderr}`);
  }

  return {
    data: result.stdout,
    mimeType: 'audio/mpeg',
    filename: 'audio.mp3'
  };
}

async function convertVideo(videoData, targetFormat, env) {
  // Basic format conversion
  const codecMap = {
    'mp4': ['-c:v', 'libx264', '-c:a', 'aac'],
    'webm': ['-c:v', 'libvpx-vp9', '-c:a', 'libopus'],
    'avi': ['-c:v', 'libx264', '-c:a', 'aac']
  };

  const codecs = codecMap[targetFormat] || ['-c:v', 'libx264', '-c:a', 'aac'];
  
  const result = await env.CLI_TOOL.execute('ffmpeg', [
    '-i', 'stdin',
    ...codecs,
    '-f', targetFormat,
    'pipe:1'
  ], {
    stdin: new Uint8Array(videoData)
  });

  if (result.exitCode !== 0) {
    throw new Error(`FFmpeg failed: ${result.stderr}`);
  }

  const mimeTypes = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo'
  };

  return {
    data: result.stdout,
    mimeType: mimeTypes[targetFormat] || 'application/octet-stream',
    filename: `converted.${targetFormat}`
  };
}

function getUsageInstructions() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>FFmpeg Worker</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; }
            .code { background: #eee; padding: 5px; font-family: monospace; }
        </style>
    </head>
    <body>
        <h1>FFmpeg Worker</h1>
        <p>This worker processes video/audio files using ffmpeg. Send a POST request with video data to one of these endpoints:</p>
        
        <div class="endpoint">
            <h3>Generate Thumbnail</h3>
            <div class="code">POST /?op=thumbnail</div>
            <p>Extracts a thumbnail image from the video at 1 second mark</p>
        </div>
        
        <div class="endpoint">
            <h3>Extract Audio</h3>
            <div class="code">POST /?op=audio</div>
            <p>Extracts the audio track as MP3</p>
        </div>
        
        <div class="endpoint">
            <h3>Convert Format</h3>
            <div class="code">POST /?op=convert&format=webm</div>
            <p>Converts video to specified format (mp4, webm, avi)</p>
        </div>

        <h3>Example Usage</h3>
        <div class="code">
curl -X POST \\<br>
&nbsp;&nbsp;--data-binary @video.mp4 \\<br>
&nbsp;&nbsp;--output thumbnail.jpg \\<br>
&nbsp;&nbsp;https://your-worker.example.com/?op=thumbnail
        </div>
    </body>
    </html>
  `;
}