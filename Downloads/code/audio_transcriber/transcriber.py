#!/usr/bin/env python3
"""
Audio Transcriber - A command-line tool for transcribing audio using Lemonfox.ai API.

This script provides two modes of operation:
1. Live microphone recording (--mic)
2. File transcription (--file)

Requirements:
    pip install -r requirements.txt

Usage:
    python transcriber.py --mic [--duration SECONDS]
    python transcriber.py --file PATH

Example:
    python transcriber.py --mic --duration 60
    python transcriber.py --file recording.mp3
"""

import os
import sys
import time
import signal
import argparse
import requests
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional, Generator

import sounddevice as sd
import numpy as np
from pydub import AudioSegment
from tqdm import tqdm
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Constants
CHUNK_DURATION = 30  # seconds
SAMPLE_RATE = 16000  # Hz
CHANNELS = 1  # Mono
CHUNK_SIZE = 1024  # samples
LEMONFOX_API_KEY = "a9xrySwxiapz1a1edsUaSFow9xyWXQL2"
LEMONFOX_API_URL = "https://api.lemonfox.ai/v1/audio/transcriptions"

def format_timestamp(seconds: float) -> str:
    """Convert seconds to MM:SS format."""
    minutes = int(seconds // 60)
    seconds = int(seconds % 60)
    return f"{minutes:02d}:{seconds:02d}"

def save_transcript(text: str, timestamp: float, output_file: str) -> None:
    """Save transcript segment with timestamp to file."""
    with open(output_file, 'a', encoding='utf-8') as f:
        f.write(f"[{format_timestamp(timestamp)}] {text}\n")

def transcribe_audio(audio_data: np.ndarray, prompt: Optional[str] = None, speaker_count: int = 2) -> str:
    """Transcribe audio data using Lemonfox.ai API."""
    try:
        # Save audio data to a temporary WAV file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_filename = temp_file.name
            audio_segment = AudioSegment(
                audio_data.tobytes(),
                frame_rate=SAMPLE_RATE,
                sample_width=2,
                channels=CHANNELS
            )
            # Normalize audio if needed
            if audio_segment.max_possible_amplitude > 0:
                audio_segment = audio_segment.normalize()
            # Add a small amount of silence at the start and end for better context
            silence = AudioSegment.silent(duration=100)  # 100ms silence
            audio_segment = silence + audio_segment + silence
            audio_segment.export(temp_filename, format='wav')

        # Prepare the API request
        headers = {
            'Authorization': f'Bearer {LEMONFOX_API_KEY}'
        }
        
        with open(temp_filename, 'rb') as audio_file:
            files = {'file': ('audio.wav', audio_file, 'audio/wav')}
            data = {
                'auto_detect_language': 'true',
                'diarization': 'true',
                'diarization_speakers': str(speaker_count),
                'timestamp': 'true',
                'model': 'whisper-1',
                'temperature': '0.0',
                'best_of': '5',
                'beam_size': '5',
                'response_format': 'verbose_json',
                'enable_speaker_diarization': 'true',
                'speaker_count': str(speaker_count),
                'speaker_diarization': 'true',
                'diarization_min_speakers': str(speaker_count),
                'diarization_max_speakers': str(speaker_count)
            }
            
            # Add prompt if provided
            if prompt:
                data['prompt'] = prompt
                
            response = requests.post(LEMONFOX_API_URL, headers=headers, files=files, data=data)
            
        # Clean up temporary file
        os.unlink(temp_filename)
        
        if response.status_code == 200:
            result = response.json()
            print(f"API Response: {result}")  # Debug log
            
            # Format the response to include speaker labels and timestamps if available
            if 'segments' in result:
                formatted_text = []
                # Track the first timestamp to normalize all timestamps
                first_timestamp = None
                current_speaker = None
                speaker_count = 0
                
                for segment in result['segments']:
                    # Get speaker information
                    speaker = segment.get('speaker', None)
                    if speaker is None:
                        # Try to get speaker from diarization results
                        speaker_id = segment.get('speaker_id', None)
                        if speaker_id is not None:
                            speaker = f"Speaker {speaker_id + 1}"
                        else:
                            # If no speaker info, try to infer from the text
                            if current_speaker is None:
                                current_speaker = "Speaker 1"
                                speaker_count = 1
                            else:
                                # Alternate speakers if we can't detect them
                                speaker_count = (speaker_count % 2) + 1
                                current_speaker = f"Speaker {speaker_count}"
                            speaker = current_speaker
                    
                    # Get timing information
                    start_time = segment.get('start', 0)
                    end_time = segment.get('end', 0)
                    
                    # Normalize timestamps to start from 0
                    if first_timestamp is None:
                        first_timestamp = start_time
                    
                    start_time = max(0, start_time - first_timestamp)
                    end_time = max(0, end_time - first_timestamp)
                    
                    # Get text
                    text = segment.get('text', '').strip()
                    
                    if text:  # Only add non-empty segments
                        # Format with proper timestamps and speaker
                        formatted_text.append(
                            f"[{format_timestamp(start_time)} - {format_timestamp(end_time)}] {speaker}: {text}"
                        )
                
                return '\n'.join(formatted_text)
            elif 'text' in result:
                text = result['text'].strip()
                if text:  # Only return non-empty text
                    return text
                return ""
            else:
                print(f"Unexpected API response format: {result}")
                return ""
        else:
            print(f"Error during transcription: {response.text}")
            return ""
            
    except Exception as e:
        print(f"Error during transcription: {e}")
        return ""

def record_audio_chunk(stop_event=None) -> None:
    """Record audio from microphone in 30-second chunks and save as WAV files."""
    def callback(indata, frames, time, status):
        if status:
            print(f"Status: {status}")
        audio_buffer.append(indata.copy())

    audio_buffer = []
    chunk_duration = 30  # seconds
    samples_per_chunk = SAMPLE_RATE * chunk_duration
    chunk_count = 0
    output_dir = "recorded_chunks"
    
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    else:
        # Clean up old chunks
        print("Cleaning up old recording chunks...")
        for old_file in os.listdir(output_dir):
            if old_file.endswith('.wav'):
                try:
                    os.remove(os.path.join(output_dir, old_file))
                except Exception as e:
                    print(f"Error removing old file {old_file}: {e}")
    
    stream = None
    try:
        # Initialize the audio stream with proper settings
        stream = sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            callback=callback,
            blocksize=CHUNK_SIZE,
            dtype=np.float32  # Use float32 for better quality
        )
        
        with stream:
            print("Recording... Press Stop button to finish")
            while True:
                time.sleep(0.1)
                # Check if we should stop
                if stop_event and stop_event.is_set():
                    print("\nStop signal received...")
                    break
                    
                if audio_buffer:
                    # Concatenate all buffered audio
                    audio_data = np.concatenate(audio_buffer)
                    if len(audio_data) >= samples_per_chunk:
                        # Take only the first 30 seconds worth of samples
                        chunk = audio_data[:samples_per_chunk]
                        
                        # Convert to 16-bit PCM
                        chunk = (chunk * 32767).astype(np.int16)
                        
                        # Save chunk as WAV file
                        chunk_count += 1
                        filename = f"chunk_{chunk_count:03d}.wav"
                        filepath = os.path.join(output_dir, filename)
                        print(f"\nSaving chunk {chunk_count} to {filepath}...")
                        
                        # Save using soundfile for better quality
                        import soundfile as sf
                        sf.write(filepath, chunk, SAMPLE_RATE)
                        print(f"Chunk {chunk_count} saved successfully.")
                        
                        # Remove the processed samples from the buffer
                        remaining = audio_data[samples_per_chunk:]
                        audio_buffer.clear()
                        if len(remaining) > 0:
                            audio_buffer.append(remaining)
    except Exception as e:
        print(f"Error during recording: {e}")
    finally:
        if stream is not None:
            print("Closing audio stream...")
            stream.stop()
            stream.close()
            print("Audio stream closed.")
        
        if audio_buffer:
            print("Processing final audio chunk...")
            audio_data = np.concatenate(audio_buffer)
            # Convert to 16-bit PCM
            audio_data = (audio_data * 32767).astype(np.int16)
            
            # Save final chunk
            chunk_count += 1
            filename = f"chunk_{chunk_count:03d}.wav"
            filepath = os.path.join(output_dir, filename)
            print(f"\nSaving final chunk to {filepath}...")
            
            # Save using soundfile for better quality
            import soundfile as sf
            sf.write(filepath, audio_data, SAMPLE_RATE)
            print("Final chunk saved successfully.")
        print("\nRecording stopped. Starting transcription process...")

def transcribe_recorded_chunks():
    """Transcribe all recorded chunks in the output directory."""
    output_dir = "recorded_chunks"
    if not os.path.exists(output_dir):
        print("No recorded chunks found.")
        return
    
    # Get all WAV files and sort them
    wav_files = sorted([f for f in os.listdir(output_dir) if f.endswith('.wav')])
    
    if not wav_files:
        print("No WAV files found in the output directory.")
        return
    
    print(f"\nTranscribing {len(wav_files)} recorded chunks...")
    
    # Create a transcript file
    transcript_file = "recording_transcript.txt"
    with open(transcript_file, 'w', encoding='utf-8') as f:
        for wav_file in wav_files:
            filepath = os.path.join(output_dir, wav_file)
            print(f"\nTranscribing {wav_file}...")
            
            try:
                # Load and transcribe the file
                audio = AudioSegment.from_wav(filepath)
                samples = np.array(audio.get_array_of_samples())
                transcript = transcribe_audio(samples)
                
                if transcript:
                    # Write to transcript file with timestamp
                    chunk_num = int(wav_file.split('_')[1].split('.')[0])
                    timestamp = chunk_num * 30  # 30 seconds per chunk
                    f.write(f"[{format_timestamp(timestamp)}] {transcript}\n")
                    print(f"Transcription: {transcript}")
                else:
                    print("No transcription generated.")
            except Exception as e:
                print(f"Error transcribing {wav_file}: {e}")
    
    print(f"\nTranscription complete. Results saved to {transcript_file}")

def process_audio_file(file_path: str) -> Generator[np.ndarray, None, None]:
    """Process audio file in chunks."""
    try:
        # Get file extension
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # Load audio file
        print(f"Loading audio file: {file_path}")
        audio = AudioSegment.from_file(file_path)
        
        # Convert to mono if stereo
        if audio.channels == 2:
            audio = audio.set_channels(1)
        
        # Set sample rate to 16kHz if different
        if audio.frame_rate != SAMPLE_RATE:
            audio = audio.set_frame_rate(SAMPLE_RATE)
        
        # Calculate chunk size in milliseconds
        chunk_length_ms = CHUNK_DURATION * 1000
        
        # Process in chunks
        total_chunks = len(audio) // chunk_length_ms + (1 if len(audio) % chunk_length_ms else 0)
        print(f"Processing {total_chunks} chunks...")
        
        for i in range(0, len(audio), chunk_length_ms):
            chunk = audio[i:i + chunk_length_ms]
            # Convert to numpy array
            samples = np.array(chunk.get_array_of_samples())
            yield samples
            
    except Exception as e:
        print(f"Error processing audio file: {e}")
        raise

def main():
    parser = argparse.ArgumentParser(description="Audio Transcriber using Lemonfox.ai API")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--mic', action='store_true', help='Record from microphone')
    group.add_argument('--file', type=str, help='Path to audio file')
    
    args = parser.parse_args()

    try:
        if args.mic:
            print("Starting microphone recording")
            # Record chunks until interrupted
            record_audio_chunk()
            # After recording is complete, transcribe all chunks
            print("\nStarting transcription of recorded chunks...")
            transcribe_recorded_chunks()
            print("\nProcess complete!")
        else:
            if not os.path.exists(args.file):
                print(f"Error: File {args.file} not found")
                sys.exit(1)
            
            print(f"Processing file: {args.file}")
            for chunk in tqdm(process_audio_file(args.file)):
                transcript = transcribe_audio(chunk)
                if transcript:
                    save_transcript(transcript, time.time(), "transcript.txt")
                    print(f"Transcribed: {transcript}")

    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 