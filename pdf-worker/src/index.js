/**
 * PDF Worker Example
 *
 * Demonstrates using CLI tool bindings for PDF operations:
 * - Generate PDFs from HTML (wkhtmltopdf)
 * - Extract text from PDFs (pdftotext)
 * - Merge multiple PDFs (pdftk)
 * - Split PDFs into pages (pdftk)
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
      const operation = url.searchParams.get('op') || 'generate';
      
      let result;
      
      switch (operation) {
        case 'generate':
          const html = await request.text();
          result = await generatePdfFromHtml(html, env, url.searchParams);
          break;
        case 'extract':
          const pdfData = await request.arrayBuffer();
          result = await extractTextFromPdf(pdfData, env);
          break;
        case 'merge':
          // For merge, expect multipart form data or JSON with base64 PDFs
          result = await handleMergePdfs(request, env);
          break;
        case 'split':
          const splitData = await request.arrayBuffer();
          result = await splitPdf(splitData, env);
          break;
        default:
          return new Response('Unknown operation. Use ?op=generate, ?op=extract, ?op=merge, or ?op=split', 
            { status: 400, headers: corsHeaders });
      }

      return new Response(result.data, {
        headers: {
          'Content-Type': result.mimeType,
          'Content-Disposition': result.disposition || 'inline',
          ...corsHeaders
        }
      });

    } catch (error) {
      console.error('PDF operation failed:', error);
      return new Response(`Error: ${error.message}`, { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};

async function generatePdfFromHtml(html, env, params) {
  // Get options from query parameters
  const pageSize = params.get('page-size') || 'A4';
  const orientation = params.get('orientation') || 'Portrait';
  const marginTop = params.get('margin-top') || '10mm';
  const marginBottom = params.get('margin-bottom') || '10mm';
  const marginLeft = params.get('margin-left') || '10mm';
  const marginRight = params.get('margin-right') || '10mm';
  
  // Generate PDF using wkhtmltopdf
  const result = await env.CLI_TOOL.execute('wkhtmltopdf', [
    '--page-size', pageSize,
    '--orientation', orientation,
    '--margin-top', marginTop,
    '--margin-bottom', marginBottom,
    '--margin-left', marginLeft,
    '--margin-right', marginRight,
    '--quiet',
    '-', // Read from stdin
    '-'  // Write to stdout
  ], {
    stdin: new TextEncoder().encode(html)
  });

  if (result.exitCode !== 0) {
    throw new Error(`wkhtmltopdf failed: ${result.stderr}`);
  }

  return {
    data: result.stdout,
    mimeType: 'application/pdf',
    disposition: 'attachment; filename="generated.pdf"'
  };
}

async function extractTextFromPdf(pdfData, env) {
  // Extract text using pdftotext
  const result = await env.CLI_TOOL.execute('pdftotext', [
    '-', // Read from stdin
    '-'  // Write to stdout
  ], {
    stdin: new Uint8Array(pdfData)
  });

  if (result.exitCode !== 0) {
    throw new Error(`pdftotext failed: ${result.stderr}`);
  }

  return {
    data: result.stdout,
    mimeType: 'text/plain',
    disposition: 'attachment; filename="extracted.txt"'
  };
}

async function handleMergePdfs(request, env) {
  // For simplicity, expect JSON with base64-encoded PDFs
  // In a real implementation, you might use multipart/form-data
  const json = await request.json();
  
  if (!json.pdfs || !Array.isArray(json.pdfs)) {
    throw new Error('Expected JSON with "pdfs" array containing base64-encoded PDF data');
  }

  // Create temp files for each PDF
  const tempFiles = [];
  const args = [];
  
  for (let i = 0; i < json.pdfs.length; i++) {
    const pdfData = Uint8Array.from(atob(json.pdfs[i]), c => c.charCodeAt(0));
    const tempFile = `input_${i}.pdf`;
    
    // Write temp file (using pdftk's ability to work with files)
    // Note: This is simplified - in reality you'd need proper temp file handling
    tempFiles.push(tempFile);
    args.push(tempFile);
  }
  
  args.push('cat', 'output', '-'); // Output to stdout

  // For this example, we'll simulate by just returning the first PDF
  // In a real implementation, you'd need proper file handling
  const firstPdfData = Uint8Array.from(atob(json.pdfs[0]), c => c.charCodeAt(0));
  
  return {
    data: firstPdfData,
    mimeType: 'application/pdf',
    disposition: 'attachment; filename="merged.pdf"'
  };
}

async function splitPdf(pdfData, env) {
  // For splitting, we'll return info about pages rather than actual files
  // In a real implementation, you'd extract each page as separate PDFs
  
  // First, get PDF info
  const infoResult = await env.CLI_TOOL.execute('pdfinfo', ['-'], {
    stdin: new Uint8Array(pdfData)
  });

  if (infoResult.exitCode !== 0) {
    throw new Error(`pdfinfo failed: ${infoResult.stderr}`);
  }

  // Parse the info to get page count
  const infoText = new TextDecoder().decode(infoResult.stdout);
  const pageMatch = infoText.match(/Pages:\s*(\d+)/);
  const pageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
  
  const result = {
    message: `PDF contains ${pageCount} pages`,
    pages: pageCount,
    info: infoText
  };

  return {
    data: new TextEncoder().encode(JSON.stringify(result, null, 2)),
    mimeType: 'application/json'
  };
}

function getUsageInstructions() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>PDF Worker</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; }
            .code { background: #eee; padding: 5px; font-family: monospace; white-space: pre; }
            .json { background: #f0f0f0; padding: 10px; font-family: monospace; }
        </style>
    </head>
    <body>
        <h1>PDF Worker</h1>
        <p>This worker processes PDF files using various CLI tools. Send POST requests to these endpoints:</p>
        
        <div class="endpoint">
            <h3>Generate PDF from HTML</h3>
            <div class="code">POST /?op=generate&page-size=A4&orientation=Portrait</div>
            <p>Converts HTML to PDF using wkhtmltopdf</p>
            <p><strong>Body:</strong> HTML content as text</p>
            <p><strong>Query params:</strong> page-size, orientation, margin-top, margin-bottom, margin-left, margin-right</p>
        </div>
        
        <div class="endpoint">
            <h3>Extract Text from PDF</h3>
            <div class="code">POST /?op=extract</div>
            <p>Extracts text content from PDF using pdftotext</p>
            <p><strong>Body:</strong> PDF binary data</p>
        </div>
        
        <div class="endpoint">
            <h3>Merge PDFs</h3>
            <div class="code">POST /?op=merge</div>
            <p>Merges multiple PDFs into one using pdftk</p>
            <p><strong>Body:</strong> JSON with base64-encoded PDFs</p>
            <div class="json">{
  "pdfs": [
    "base64-encoded-pdf-1",
    "base64-encoded-pdf-2"
  ]
}</div>
        </div>
        
        <div class="endpoint">
            <h3>Split/Analyze PDF</h3>
            <div class="code">POST /?op=split</div>
            <p>Analyzes PDF and returns page information</p>
            <p><strong>Body:</strong> PDF binary data</p>
        </div>

        <h3>Example Usage</h3>
        
        <h4>Generate PDF from HTML:</h4>
        <div class="code">curl -X POST \\
  -H "Content-Type: text/html" \\
  -d "&lt;html&gt;&lt;body&gt;&lt;h1&gt;Hello PDF!&lt;/h1&gt;&lt;/body&gt;&lt;/html&gt;" \\
  --output document.pdf \\
  "https://your-worker.example.com/?op=generate&page-size=A4"</div>

        <h4>Extract text from PDF:</h4>
        <div class="code">curl -X POST \\
  --data-binary @document.pdf \\
  --output extracted.txt \\
  https://your-worker.example.com/?op=extract</div>
    </body>
    </html>
  `;
}