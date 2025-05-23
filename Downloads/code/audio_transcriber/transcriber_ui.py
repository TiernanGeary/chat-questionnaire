#!/usr/bin/env python3
"""
Audio Transcriber UI - A graphical interface for the audio transcription tool.
"""

import sys
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional
import threading

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QFileDialog, QTextEdit, QProgressBar,
    QMessageBox, QSpinBox
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QIcon, QFont

from transcriber import (
    transcribe_audio, record_audio_chunk, process_audio_file,
    format_timestamp, save_transcript, transcribe_recorded_chunks
)

class TranscriptionWorker(QThread):
    """Worker thread for handling transcription tasks."""
    finished = pyqtSignal()
    error = pyqtSignal(str)
    progress = pyqtSignal(str)
    status = pyqtSignal(str)  # New signal for status updates
    
    def __init__(self, selected_file=None, prompt=None, speaker_count=2):
        super().__init__()
        self.selected_file = selected_file
        self.prompt = prompt
        self.speaker_count = speaker_count
        self.is_recording = False
        self.stop_event = threading.Event()
    
    def run(self):
        try:
            if self.selected_file:
                # File mode
                self.status.emit("Processing file...")
                for chunk in process_audio_file(self.selected_file):
                    transcript = transcribe_audio(chunk, self.prompt, self.speaker_count)
                    if transcript:
                        self.progress.emit(transcript)
            else:
                # Microphone mode
                self.is_recording = True
                self.stop_event.clear()  # Reset the stop event
                self.status.emit("Recording started...")
                record_audio_chunk(self.stop_event)  # Pass the stop event
                self.is_recording = False
                
                # Now transcribe all recorded chunks
                self.status.emit("Recording finished. Starting transcription...")
                transcribe_recorded_chunks()
                
                # Read and emit the transcript
                try:
                    with open("recording_transcript.txt", 'r', encoding='utf-8') as f:
                        transcript = f.read()
                        self.progress.emit(transcript)
                    self.status.emit("Transcription complete!")
                except Exception as e:
                    self.error.emit(f"Error reading transcript: {e}")
            
            self.finished.emit()
        except Exception as e:
            self.error.emit(str(e))
    
    def stop(self):
        self.is_recording = False
        self.stop_event.set()  # Set the stop event
        self.status.emit("Stopping recording...")

class MainWindow(QMainWindow):
    """Main window for the Audio Transcriber application."""
    def __init__(self):
        super().__init__()
        self.worker = None
        self.init_ui()

    def init_ui(self):
        """Initialize the user interface."""
        self.setWindowTitle("Audio Transcriber")
        self.setMinimumSize(800, 600)

        # Create central widget and layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)

        # Status label
        self.status_label = QLabel("Ready")
        layout.addWidget(self.status_label)

        # Chunks directory info
        chunks_layout = QHBoxLayout()
        chunks_label = QLabel("Recording chunks saved in: recorded_chunks/")
        self.open_chunks_button = QPushButton("Open Chunks Folder")
        chunks_layout.addWidget(chunks_label)
        chunks_layout.addWidget(self.open_chunks_button)
        layout.addLayout(chunks_layout)

        # Mode selection
        mode_layout = QHBoxLayout()
        self.mic_button = QPushButton("Record from Microphone")
        self.file_mode_button = QPushButton("Transcribe File")
        mode_layout.addWidget(self.mic_button)
        mode_layout.addWidget(self.file_mode_button)
        layout.addLayout(mode_layout)

        # File selection (for file mode)
        file_layout = QHBoxLayout()
        self.file_label = QLabel("No file selected")
        self.select_file_button = QPushButton("Select File")
        file_layout.addWidget(self.file_label)
        file_layout.addWidget(self.select_file_button)
        layout.addLayout(file_layout)

        # Prompt input
        prompt_layout = QHBoxLayout()
        prompt_label = QLabel("Context Prompt (optional):")
        self.prompt_input = QTextEdit()
        self.prompt_input.setMaximumHeight(60)
        self.prompt_input.setPlaceholderText("Enter any context that might help with transcription (e.g., 'This is a medical interview', 'Technical discussion about AI')")
        prompt_layout.addWidget(prompt_label)
        prompt_layout.addWidget(self.prompt_input)
        layout.addLayout(prompt_layout)

        # Speaker settings
        speaker_layout = QHBoxLayout()
        speaker_label = QLabel("Number of Speakers:")
        self.speaker_count = QSpinBox()
        self.speaker_count.setMinimum(1)
        self.speaker_count.setMaximum(10)
        self.speaker_count.setValue(2)  # Default to 2 speakers
        self.speaker_count.setToolTip("Set the number of speakers to detect (or leave as 2 for auto-detection)")
        speaker_layout.addWidget(speaker_label)
        speaker_layout.addWidget(self.speaker_count)
        layout.addLayout(speaker_layout)

        # Control buttons
        control_layout = QHBoxLayout()
        self.start_button = QPushButton("Start")
        self.stop_button = QPushButton("Stop")
        self.stop_button.setEnabled(False)
        control_layout.addWidget(self.start_button)
        control_layout.addWidget(self.stop_button)
        layout.addLayout(control_layout)

        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setTextVisible(False)
        layout.addWidget(self.progress_bar)

        # Transcript display
        self.transcript_display = QTextEdit()
        self.transcript_display.setReadOnly(True)
        layout.addWidget(self.transcript_display)

        # Connect signals
        self.mic_button.clicked.connect(lambda: self.set_mode("mic"))
        self.file_mode_button.clicked.connect(lambda: self.set_mode("file"))
        self.select_file_button.clicked.connect(self.select_file)
        self.start_button.clicked.connect(self.start_transcription)
        self.stop_button.clicked.connect(self.stop_transcription)
        self.open_chunks_button.clicked.connect(self.open_chunks_folder)

        # Set initial mode
        self.set_mode("mic")
        self.selected_file = None

    def set_mode(self, mode: str):
        """Set the current transcription mode."""
        self.current_mode = mode
        self.select_file_button.setEnabled(mode == "file")
        self.file_label.setEnabled(mode == "file")
        
        # Update button states
        self.mic_button.setChecked(mode == "mic")
        self.file_mode_button.setChecked(mode == "file")
        
        # Clear file selection when switching to mic mode
        if mode == "mic":
            self.selected_file = None
            self.file_label.setText("No file selected")

    def select_file(self):
        """Open file dialog to select an audio file."""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select Audio File",
            "",
            "Audio Files (*.mp3 *.wav *.mp4 *.m4a);;All Files (*.*)"
        )
        if file_path:
            self.selected_file = file_path
            self.file_label.setText(os.path.basename(file_path))

    def start_transcription(self):
        """Start the transcription process."""
        if self.current_mode == "file" and not self.selected_file:
            QMessageBox.warning(self, "Error", "Please select a file first.")
            return

        self.transcript_display.clear()
        self.start_button.setEnabled(False)
        self.stop_button.setEnabled(True)
        self.progress_bar.setRange(0, 0)  # Indeterminate progress

        prompt = self.prompt_input.toPlainText().strip()
        speaker_count = self.speaker_count.value()
        self.worker = TranscriptionWorker(
            self.selected_file,
            prompt if prompt else None,
            speaker_count
        )
        self.worker.progress.connect(self.update_transcript)
        self.worker.finished.connect(self.transcription_finished)
        self.worker.error.connect(self.show_error)
        self.worker.status.connect(self.update_status)
        self.worker.start()

    def update_status(self, status: str):
        """Update the status label."""
        self.status_label.setText(status)

    def stop_transcription(self):
        """Stop the transcription process."""
        if self.worker:
            self.worker.stop()
            self.update_status("Stopping recording...")
            # Don't wait for the worker to finish here
            # Let it finish naturally and call transcription_finished

    def update_transcript(self, text: str):
        """Update the transcript display with new text."""
        # Split the text into lines (each line is a segment)
        segments = text.split('\n')
        for segment in segments:
            # Create a new paragraph for each segment
            cursor = self.transcript_display.textCursor()
            cursor.movePosition(cursor.MoveOperation.End)
            self.transcript_display.setTextCursor(cursor)
            
            # Apply formatting based on speaker
            if ': ' in segment:
                # Split timestamp and rest of the text
                timestamp_end = segment.find('] ') + 2
                timestamp = segment[:timestamp_end]
                rest = segment[timestamp_end:]
                
                # Split speaker and text
                speaker, text = rest.split(': ', 1)
                
                # Format the timestamp
                self.transcript_display.insertHtml(f'<span style="color: gray;">{timestamp}</span> ')
                
                # Format the speaker name with a unique color
                speaker_hash = hash(speaker) % 360  # Generate a hue value
                self.transcript_display.insertHtml(
                    f'<span style="color: hsl({speaker_hash}, 70%, 50%); font-weight: bold;">{speaker}:</span> '
                )
                
                # Add the text
                self.transcript_display.insertHtml(f'{text}<br>')
            else:
                # If no speaker is detected, just add the text
                self.transcript_display.insertHtml(f'{segment}<br>')
        
        # Scroll to the bottom
        self.transcript_display.verticalScrollBar().setValue(
            self.transcript_display.verticalScrollBar().maximum()
        )

    def transcription_finished(self):
        """Handle transcription completion."""
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(False)
        self.progress_bar.setRange(0, 1)
        self.progress_bar.setValue(1)

    def show_error(self, error_msg: str):
        """Show error message to the user."""
        QMessageBox.critical(self, "Error", f"An error occurred: {error_msg}")
        self.transcription_finished()

    def open_chunks_folder(self):
        """Open the recorded chunks directory in the system's file explorer."""
        chunks_dir = os.path.abspath("recorded_chunks")
        if os.path.exists(chunks_dir):
            if sys.platform == "darwin":  # macOS
                os.system(f"open {chunks_dir}")
            elif sys.platform == "win32":  # Windows
                os.system(f"explorer {chunks_dir}")
            else:  # Linux
                os.system(f"xdg-open {chunks_dir}")
        else:
            QMessageBox.warning(self, "Warning", "No recorded chunks directory found.")

def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main() 