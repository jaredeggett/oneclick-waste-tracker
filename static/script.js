/**
 * OneClick Voice Waste Tracker
 * Voice-enabled food waste logging with camera capture
 */

class WasteTracker {
    constructor() {
        // State
        this.isListening = false;
        this.isProcessing = false;
        this.currentTranscript = '';
        this.currentInterpretation = null;
        this.autoConfirmTimer = null;
        this.autoConfirmCountdown = 5;

        // Camera
        this.cameraStream = null;
        this.capturedPhoto = null;

        // Speech Recognition
        this.recognition = null;
        this.silenceTimer = null;

        // Word tracking for animation
        this.displayedWords = [];
        this.lastWordCount = 0;

        // DOM Elements
        this.elements = {
            wasteButton: document.getElementById('log-waste-btn'),
            statusText: document.getElementById('status-text'),
            transcriptContainer: document.getElementById('transcript-container'),
            transcriptText: document.getElementById('transcript-text'),
            interpretationContainer: document.getElementById('interpretation-container'),
            itemIcon: document.getElementById('item-icon'),
            itemName: document.getElementById('item-name'),
            itemMeta: document.getElementById('item-meta'),
            btnConfirm: document.getElementById('btn-confirm'),
            btnEdit: document.getElementById('btn-edit'),
            countdown: document.getElementById('countdown'),
            logList: document.getElementById('log-list'),
            toast: document.getElementById('success-toast'),
            toastMessage: document.getElementById('toast-message'),
            cameraPreview: document.getElementById('camera-preview'),
            cameraPlaceholder: document.getElementById('camera-placeholder'),
            cameraCanvas: document.getElementById('camera-canvas')
        };

        // Initialize
        this.init();
    }

    init() {
        this.setupSpeechRecognition();
        this.setupEventListeners();
        this.loadRecentLog();
        this.initCamera();
    }

    // Camera Setup
    async initCamera() {
        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 }
            });
            this.elements.cameraPreview.srcObject = this.cameraStream;
            this.elements.cameraPlaceholder.classList.add('hidden');
        } catch (err) {
            console.log('Camera not available:', err.message);
            // Camera is optional - continue without it
        }
    }

    capturePhoto() {
        if (!this.cameraStream) return null;

        const video = this.elements.cameraPreview;
        const canvas = this.elements.cameraCanvas;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        return canvas.toDataURL('image/jpeg', 0.7);
    }

    // Speech Recognition Setup
    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error('Speech Recognition not supported');
            this.elements.statusText.textContent = 'Voice not supported in this browser';
            this.elements.statusText.classList.add('error');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateUI('listening');
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            this.currentTranscript = finalTranscript || interimTranscript;

            // Show transcript container
            this.elements.transcriptContainer.classList.add('visible');

            // Animate words appearing
            this.animateTranscript(this.currentTranscript, !!finalTranscript);

            // Reset silence timer
            this.resetSilenceTimer();

            // If we got a final result, process it
            if (finalTranscript) {
                this.stopListening();
                this.processTranscript(finalTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;

            if (event.error === 'no-speech') {
                this.updateUI('idle', 'No speech detected. Tap to try again.');
            } else if (event.error === 'not-allowed') {
                this.updateUI('error', 'Microphone access denied');
            } else {
                this.updateUI('error', 'Error: ' + event.error);
            }
        };

        this.recognition.onend = () => {
            this.isListening = false;

            // If we have a transcript but haven't processed it yet, process it now
            // This handles cases where isFinal never fires
            if (this.currentTranscript && !this.isProcessing && !this.currentInterpretation) {
                this.processTranscript(this.currentTranscript);
            } else if (!this.isProcessing && !this.currentInterpretation) {
                this.updateUI('idle');
            }
        };
    }

    resetSilenceTimer() {
        if (this.silenceTimer) clearTimeout(this.silenceTimer);

        this.silenceTimer = setTimeout(() => {
            if (this.isListening && this.currentTranscript) {
                this.stopListening();
                this.processTranscript(this.currentTranscript);
            }
        }, 2000); // 2 seconds of silence
    }

    // Animate words appearing one by one
    animateTranscript(text, isFinal) {
        const words = text.trim().split(/\s+/);
        const transcriptEl = this.elements.transcriptText;

        // Clear if starting fresh
        if (words.length < this.lastWordCount) {
            transcriptEl.innerHTML = '';
            this.displayedWords = [];
            this.lastWordCount = 0;
        }

        // Add new words with animation
        for (let i = this.displayedWords.length; i < words.length; i++) {
            const word = words[i];
            if (!word) continue;

            const wordSpan = document.createElement('span');
            wordSpan.className = `word ${isFinal ? 'final' : 'interim'}`;
            wordSpan.textContent = word + ' ';
            wordSpan.style.animationDelay = `${(i - this.displayedWords.length) * 0.05}s`;

            transcriptEl.appendChild(wordSpan);
            this.displayedWords.push(word);
        }

        // Update existing interim words to final if needed
        if (isFinal) {
            const wordSpans = transcriptEl.querySelectorAll('.word.interim');
            wordSpans.forEach(span => {
                span.classList.remove('interim');
                span.classList.add('final');
            });
        }

        this.lastWordCount = words.length;
    }

    // Event Listeners
    setupEventListeners() {
        // Main button
        this.elements.wasteButton.addEventListener('click', () => this.toggleListening());

        // Confirm button
        this.elements.btnConfirm.addEventListener('click', () => this.confirmEntry());

        // Edit button
        this.elements.btnEdit.addEventListener('click', () => this.editEntry());

        // Keyboard shortcut (Space to start/stop)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                this.toggleListening();
            }
        });
    }

    // Main Actions
    toggleListening() {
        if (this.isProcessing) return;

        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    startListening() {
        if (!this.recognition) {
            this.showToast('Voice recognition not available');
            return;
        }

        // Reset state
        this.currentTranscript = '';
        this.currentInterpretation = null;
        this.cancelAutoConfirm();

        // Reset word tracking
        this.displayedWords = [];
        this.lastWordCount = 0;

        // Hide previous results
        this.elements.transcriptContainer.classList.remove('visible');
        this.elements.transcriptContainer.classList.remove('processing');
        this.elements.interpretationContainer.classList.remove('visible');
        this.elements.transcriptText.innerHTML = '';

        // Capture photo
        this.capturedPhoto = this.capturePhoto();

        // Start recognition
        try {
            this.recognition.start();
        } catch (err) {
            console.error('Failed to start recognition:', err);
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
        }
        this.isListening = false;
    }

    async processTranscript(transcript) {
        if (!transcript.trim()) {
            this.updateUI('idle', 'No speech detected. Tap to try again.');
            return;
        }

        this.isProcessing = true;
        this.updateUI('processing');

        // Add processing state to transcript container
        this.elements.transcriptContainer.classList.add('processing');

        try {
            const response = await fetch('/api/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: transcript })
            });

            const data = await response.json();

            // Remove processing state
            this.elements.transcriptContainer.classList.remove('processing');

            if (data.items && data.items.length > 0) {
                this.currentInterpretation = {
                    ...data.items[0],
                    originalInput: transcript,
                    confidence: data.confidence
                };
                this.showInterpretation(this.currentInterpretation);
                this.startAutoConfirm();
            } else {
                this.updateUI('error', 'Could not understand. Please try again.');
            }
        } catch (err) {
            console.error('Parse error:', err);
            this.elements.transcriptContainer.classList.remove('processing');
            this.updateUI('error', 'Connection error. Please try again.');
        } finally {
            this.isProcessing = false;
        }
    }

    showInterpretation(item) {
        const icon = this.getCategoryIcon(item.subcategory || item.category);

        this.elements.itemIcon.textContent = icon;
        this.elements.itemName.textContent = item.name;
        this.elements.itemMeta.textContent = `${item.quantity} ${item.unit} • ${this.formatCategory(item.subcategory || item.category)}`;

        this.elements.interpretationContainer.classList.add('visible');
        this.updateUI('confirm');
    }

    getCategoryIcon(category) {
        const icons = {
            proteins: '🍗',
            produce: '🥬',
            breads: '🥐',
            dairy: '🧀',
            dry_goods: '🌾',
            oils_liquids: '🫗',
            entrees: '🍔',
            breakfast: '🍳',
            sides: '🍟',
            treats: '🍦',
            beverages: '🥤',
            sauces: '🫙'
        };
        return icons[category] || '📦';
    }

    formatCategory(category) {
        return category
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    // Auto-confirm countdown
    startAutoConfirm() {
        this.autoConfirmCountdown = 5;
        this.updateCountdown();

        this.autoConfirmTimer = setInterval(() => {
            this.autoConfirmCountdown--;
            this.updateCountdown();

            if (this.autoConfirmCountdown <= 0) {
                this.confirmEntry();
            }
        }, 1000);
    }

    updateCountdown() {
        if (this.autoConfirmCountdown > 0) {
            this.elements.countdown.textContent = `(${this.autoConfirmCountdown}s)`;
        } else {
            this.elements.countdown.textContent = '';
        }
    }

    cancelAutoConfirm() {
        if (this.autoConfirmTimer) {
            clearInterval(this.autoConfirmTimer);
            this.autoConfirmTimer = null;
        }
        this.elements.countdown.textContent = '';
    }

    async confirmEntry() {
        this.cancelAutoConfirm();

        if (!this.currentInterpretation) return;

        try {
            const response = await fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original_input: this.currentInterpretation.originalInput,
                    item_name: this.currentInterpretation.name,
                    quantity: this.currentInterpretation.quantity,
                    unit: this.currentInterpretation.unit,
                    category: this.currentInterpretation.category,
                    subcategory: this.currentInterpretation.subcategory,
                    employee_photo: this.capturedPhoto
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast(`Logged: ${data.entry.item_name} - ${data.entry.quantity} ${data.entry.unit}`);
                this.addToLog(data.entry);
                this.resetState();
            } else {
                this.showToast('Failed to log entry', true);
            }
        } catch (err) {
            console.error('Log error:', err);
            this.showToast('Connection error', true);
        }
    }

    editEntry() {
        this.cancelAutoConfirm();
        // For now, just restart - could open edit modal in future
        this.resetState();
        this.showToast('Tap button to try again');
    }

    resetState() {
        this.currentTranscript = '';
        this.currentInterpretation = null;
        this.capturedPhoto = null;
        this.displayedWords = [];
        this.lastWordCount = 0;
        this.elements.transcriptContainer.classList.remove('visible');
        this.elements.transcriptContainer.classList.remove('processing');
        this.elements.interpretationContainer.classList.remove('visible');
        this.elements.transcriptText.innerHTML = '';
        this.updateUI('idle');
    }

    // Log Display
    addToLog(entry) {
        const emptyMsg = this.elements.logList.querySelector('.log-empty');
        if (emptyMsg) emptyMsg.remove();

        const icon = this.getCategoryIcon(entry.subcategory || entry.category);
        const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });

        const entryEl = document.createElement('div');
        entryEl.className = 'log-entry';
        entryEl.innerHTML = `
            <span class="log-entry-icon">${icon}</span>
            <div class="log-entry-details">
                <span class="log-entry-name">${entry.item_name}</span>
                <span class="log-entry-meta">${this.formatCategory(entry.subcategory || entry.category)} • ${time}</span>
            </div>
            <span class="log-entry-quantity">${entry.quantity} ${entry.unit}</span>
        `;

        this.elements.logList.insertBefore(entryEl, this.elements.logList.firstChild);

        // Keep only last 10 entries visible
        const entries = this.elements.logList.querySelectorAll('.log-entry');
        if (entries.length > 10) {
            entries[entries.length - 1].remove();
        }
    }

    async loadRecentLog() {
        try {
            const response = await fetch('/api/log?limit=10');
            const entries = await response.json();

            if (entries.length > 0) {
                const emptyMsg = this.elements.logList.querySelector('.log-empty');
                if (emptyMsg) emptyMsg.remove();

                entries.forEach(entry => {
                    const icon = this.getCategoryIcon(entry.subcategory || entry.category);
                    const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                    });

                    const entryEl = document.createElement('div');
                    entryEl.className = 'log-entry';
                    entryEl.innerHTML = `
                        <span class="log-entry-icon">${icon}</span>
                        <div class="log-entry-details">
                            <span class="log-entry-name">${entry.item_name}</span>
                            <span class="log-entry-meta">${this.formatCategory(entry.subcategory || entry.category)} • ${time}</span>
                        </div>
                        <span class="log-entry-quantity">${entry.quantity} ${entry.unit}</span>
                    `;
                    this.elements.logList.appendChild(entryEl);
                });
            }
        } catch (err) {
            console.log('Could not load recent log');
        }
    }

    // UI State
    updateUI(state, message = null) {
        const button = this.elements.wasteButton;
        const status = this.elements.statusText;

        // Remove all state classes
        button.classList.remove('listening', 'processing');
        status.classList.remove('listening', 'processing', 'error');

        switch (state) {
            case 'listening':
                button.classList.add('listening');
                status.classList.add('listening');
                status.textContent = 'Listening...';
                break;
            case 'processing':
                button.classList.add('processing');
                status.classList.add('processing');
                status.textContent = 'Processing...';
                break;
            case 'confirm':
                status.textContent = 'Confirm or edit below';
                break;
            case 'error':
                status.classList.add('error');
                status.textContent = message || 'Error occurred';
                break;
            case 'idle':
            default:
                status.textContent = message || 'Tap to speak';
                break;
        }
    }

    // Toast Notification
    showToast(message, isError = false) {
        this.elements.toastMessage.textContent = message;
        this.elements.toast.classList.add('visible');

        if (isError) {
            this.elements.toast.querySelector('svg').style.stroke = '#EF4444';
        } else {
            this.elements.toast.querySelector('svg').style.stroke = '#10B981';
        }

        setTimeout(() => {
            this.elements.toast.classList.remove('visible');
        }, 3000);
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.wasteTracker = new WasteTracker();
});
