# Audio Transcriber

A command-line tool for transcribing audio using Lemonfox.ai API. This tool supports both live microphone recording and file transcription.

## Features

- Live microphone recording with configurable duration
- Support for various audio file formats (MP3, WAV, MP4, etc.)
- Real-time transcription streaming
- Timestamp-based transcript output
- Graceful error handling

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd audio_transcriber
```

2. Install the required dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Microphone Recording

To record and transcribe from your microphone:

```bash
python transcriber.py --mic [--duration SECONDS]
```

Example:
```bash
python transcriber.py --mic --duration 60
```

### File Transcription

To transcribe an existing audio file:

```bash
python transcriber.py --file PATH
```

Example:
```bash
python transcriber.py --file recording.mp3
```

## Output

The transcription will be saved to `transcript.txt` in the current directory, with timestamps for each segment.

## Error Handling

The tool handles various error cases:
- Invalid file paths
- Network issues
- Microphone access errors
- API errors

## Requirements

- Python 3.7+
- Internet connection
- Microphone (for live recording mode)

## License

MIT License 