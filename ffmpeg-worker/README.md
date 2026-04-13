# FFmpeg Worker Example

This example demonstrates how to use FlameFlare's CLI tool binding to process video and audio files with ffmpeg.

## Features

- **Thumbnail Generation**: Extract thumbnail images from videos
- **Audio Extraction**: Extract audio tracks as MP3 files  
- **Format Conversion**: Convert videos between formats (MP4, WebM, AVI)

## Deployment

1. Deploy to FlameFlare:
   ```bash
   ff deploy
   ```

2. The worker will be available at your assigned URL

## Usage

The worker accepts POST requests with video data in the body:

### Generate Thumbnail
```bash
curl -X POST \
  --data-binary @video.mp4 \
  --output thumbnail.jpg \
  https://your-worker.example.com/?op=thumbnail
```

### Extract Audio
```bash
curl -X POST \
  --data-binary @video.mp4 \
  --output audio.mp3 \
  https://your-worker.example.com/?op=audio
```

### Convert Format
```bash
curl -X POST \
  --data-binary @video.mp4 \
  --output converted.webm \
  "https://your-worker.example.com/?op=convert&format=webm"
```

## Supported Operations

| Operation | Query Parameter | Description |
|-----------|----------------|-------------|
| `thumbnail` | `?op=thumbnail` | Extract thumbnail at 1s mark |
| `audio` | `?op=audio` | Extract audio as MP3 |
| `convert` | `?op=convert&format=FORMAT` | Convert to specified format |

## Supported Formats

- **Input**: Any format supported by ffmpeg (MP4, AVI, MOV, MKV, etc.)
- **Output**: 
  - Thumbnails: JPEG
  - Audio: MP3 (192kbps)
  - Video: MP4, WebM, AVI

## Implementation Notes

This worker uses the `CLI_TOOL` binding to execute ffmpeg commands in a sandboxed environment. The implementation shows how to:

- Process binary data from request bodies
- Execute CLI tools with proper error handling
- Stream data through stdin/stdout
- Return appropriate MIME types and filenames

## Error Handling

The worker includes comprehensive error handling for:
- Missing input data
- Unsupported operations
- ffmpeg execution failures
- Invalid formats

All errors return HTTP error codes with descriptive messages.