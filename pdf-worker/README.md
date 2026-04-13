# PDF Worker Example

This example demonstrates how to use FlameFlare's CLI tool binding to perform various PDF operations using tools like weasyprint (or wkhtmltopdf), pdftotext, pdftk, and pdfinfo.

## Features

- **PDF Generation**: Convert HTML to PDF with customizable formatting
- **Text Extraction**: Extract text content from PDF files
- **PDF Merging**: Combine multiple PDFs into one (simplified example)
- **PDF Analysis**: Get information about PDF structure and page count

## Deployment

1. Deploy to FlameFlare:
   ```bash
   ff deploy
   ```

2. The worker will be available at your assigned URL

## Usage

### Generate PDF from HTML

Convert HTML content to PDF:

```bash
curl -X POST \
  -H "Content-Type: text/html" \
  -d "<html><body><h1>Hello PDF!</h1><p>This is a test document.</p></body></html>" \
  --output document.pdf \
  "https://your-worker.example.com/?op=generate&page-size=A4&orientation=Portrait"
```

**Query Parameters:**
- `page-size`: Page size (A4, Letter, Legal, etc.)
- `orientation`: Portrait or Landscape
- `margin-top`, `margin-bottom`, `margin-left`, `margin-right`: Margins (e.g., "10mm", "1in")

### Extract Text from PDF

Extract plain text from a PDF:

```bash
curl -X POST \
  --data-binary @document.pdf \
  --output extracted.txt \
  https://your-worker.example.com/?op=extract
```

### Merge PDFs

Merge multiple PDFs (expects JSON with base64-encoded PDFs):

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "pdfs": [
      "base64-encoded-pdf-1-data-here",
      "base64-encoded-pdf-2-data-here"
    ]
  }' \
  --output merged.pdf \
  https://your-worker.example.com/?op=merge
```

### Analyze PDF

Get information about a PDF (page count, metadata):

```bash
curl -X POST \
  --data-binary @document.pdf \
  https://your-worker.example.com/?op=split
```

Returns JSON with PDF information.

## Supported Operations

| Operation | Query Parameter | Input | Output |
|-----------|----------------|-------|--------|
| `generate` | `?op=generate` | HTML (text/html) | PDF file |
| `extract` | `?op=extract` | PDF (binary) | Text file |
| `merge` | `?op=merge` | JSON with base64 PDFs | PDF file |
| `split` | `?op=split` | PDF (binary) | JSON with info |

## CLI Tools Used

- **weasyprint**: HTML to PDF conversion (preferred, modern, actively maintained)
- **wkhtmltopdf**: HTML to PDF conversion (legacy fallback)
- **pdftotext**: Text extraction from PDFs  
- **pdftk**: PDF manipulation (merge, split, etc.)
- **pdfinfo**: PDF metadata and information

> **Note:** FlameFlare auto-detects which HTML-to-PDF tool is available, preferring weasyprint over wkhtmltopdf. Install via `brew install weasyprint` (macOS) or `pip install weasyprint` (Linux).

## Implementation Notes

This worker demonstrates several key concepts:

1. **Binary Data Handling**: Processing PDF files as binary data
2. **Text Processing**: Converting HTML to PDF
3. **Tool Chaining**: Using multiple CLI tools for different operations
4. **Error Handling**: Proper error responses for tool failures
5. **Parameter Passing**: Using query parameters to configure tool behavior

## Limitations

- **Merge Operation**: The example shows a simplified merge implementation. A production version would need proper temporary file handling.
- **Security**: Input validation should be enhanced for production use.
- **File Size**: Large PDFs may hit worker memory limits.

## Error Handling

The worker includes error handling for:
- Invalid operations
- Missing input data
- CLI tool execution failures
- Malformed JSON inputs
- PDF processing errors

All errors return appropriate HTTP status codes with descriptive messages.