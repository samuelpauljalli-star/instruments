document.addEventListener('DOMContentLoaded', () => {
    const analyzerToggle = document.getElementById('analyzer-toggle');
    const dashboard = document.getElementById('analyzer-dashboard');
    const closeBtn = document.getElementById('analyzer-close');
    const micBtn = document.getElementById('analyzer-mic');
    const statusText = document.getElementById('analyzer-status');
    const lyricsBox = document.getElementById('lyrics-output');
    const notesBox = document.getElementById('notes-output');
    const scaleBox = document.getElementById('scale-output');
    const saveBtn = document.getElementById('save-song-btn');
    const saveInput = document.getElementById('song-name-input');
    const historyList = document.getElementById('history-list');
    const clearBtn = document.getElementById('clear-notes-btn');
    const exportBtn = document.getElementById('export-song-btn');

    let isListening = false;
    let audioCtx = null;
    let analyser = null;
    let microphone = null;
    let animationId = null;
    let recognition = null;
    let mediaStream = null;

    let currentSession = {
        lyrics: '',
        notes: [],
        scale: 'Unknown'
    };

    let history = JSON.parse(localStorage.getItem('casio_song_history')) || [];
    renderHistory();

    if (analyzerToggle && dashboard && closeBtn) {
        analyzerToggle.addEventListener('click', () => dashboard.classList.add('active'));
        closeBtn.addEventListener('click', () => {
            dashboard.classList.remove('active');
            stopListening();
        });
    }

    // Speech Recognition Setup (Telugu)
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'te-IN'; // Telugu

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                }
            }
            if (finalTranscript) {
                currentSession.lyrics += finalTranscript;
                lyricsBox.innerHTML += finalTranscript;
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
        };
    }

    micBtn.addEventListener('click', async () => {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.error("AudioContext initialization failed", e);
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            try {
                await audioCtx.resume();
            } catch (e) {
                console.error("Failed to resume AudioContext", e);
            }
        }

        if (!isListening) {
            startListening();
        } else {
            stopListening();
        }
    });

    async function startListening() {
        try {
            // Ensure AudioContext is initialized and resumed synchronously
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            // Get microphone stream with mobile-compatible, standard constraints
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            mediaStream = stream;
            
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            microphone = audioCtx.createMediaStreamSource(stream);
            microphone.connect(analyser);

            isListening = true;
            micBtn.classList.add('listening');
            statusText.textContent = "Listening to song (Telugu)... Play or sing near mic!";
            
            // Reset current session
            currentSession = { lyrics: '', notes: [], scale: 'Detecting...' };
            lyricsBox.innerHTML = '';
            notesBox.innerHTML = '';
            scaleBox.textContent = 'Analyzing...';

            if (recognition) {
                try { 
                    recognition.start(); 
                } catch(e) {
                    console.warn("Speech recognition failed to start", e);
                }
            }

            detectPitch();
        } catch (err) {
            console.error("Microphone access denied or not available", err);
            statusText.textContent = "Error: Microphone access denied or not supported.";
        }
    }

    function stopListening() {
        isListening = false;
        micBtn.classList.remove('listening');
        statusText.textContent = "Analysis stopped. Ready to save.";
        
        if (microphone) {
            try {
                microphone.disconnect();
            } catch(e) {}
            microphone = null;
        }

        if (mediaStream) {
            try {
                mediaStream.getTracks().forEach(track => track.stop());
            } catch(e) {}
            mediaStream = null;
        }

        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        if (recognition) {
            try { 
                recognition.stop(); 
            } catch(e) {}
        }

        determineScale();
    }

    // Auto-correlation Pitch Detection
    const bufferLength = 2048;
    const buffer = new Float32Array(bufferLength);
    let lastNoteTime = 0;

    function detectPitch() {
        if (!isListening) return;

        analyser.getFloatTimeDomainData(buffer);
        let ac = autoCorrelate(buffer, audioCtx.sampleRate);

        if (ac !== -1) {
            let noteStr = frequencyToNoteString(ac);
            let now = Date.now();
            
            // Debounce notes to avoid spamming the UI
            if (noteStr && (now - lastNoteTime > 400)) {
                // Restrict to ~ 2 octaves (e.g. C3 to C5 approx)
                if (ac >= 130 && ac <= 523) { 
                    currentSession.notes.push(noteStr);
                    let badge = document.createElement('span');
                    badge.className = 'note-badge';
                    badge.textContent = noteStr;
                    notesBox.appendChild(badge);
                    lastNoteTime = now;
                }
            }
        }

        animationId = requestAnimationFrame(detectPitch);
    }

    function autoCorrelate(buf, sampleRate) {
        let SIZE = buf.length;
        let rms = 0;
        for (let i = 0; i < SIZE; i++) {
            let val = buf[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return -1; // Not enough signal

        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (var i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
        for (var i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

        buf = buf.slice(r1, r2);
        SIZE = buf.length;

        let c = new Array(SIZE).fill(0);
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE - i; j++) {
                c[i] = c[i] + buf[j] * buf[j + i];
            }
        }

        let d = 0; while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < SIZE; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }
        let T0 = maxpos;
        return sampleRate / T0;
    }

    const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    function frequencyToNoteString(freq) {
        let noteNum = 12 * (Math.log(freq / 440) / Math.log(2));
        let index = Math.round(noteNum) + 69;
        let octave = Math.floor(index / 12) - 1;
        let noteName = noteStrings[index % 12];
        return noteName; // e.g. "C", ignoring octave for scale analysis
    }

    function determineScale() {
        if (currentSession.notes.length === 0) {
            scaleBox.textContent = "Could not detect notes";
            return;
        }

        // Count occurrences of each note
        let counts = {};
        currentSession.notes.forEach(n => counts[n] = (counts[n] || 0) + 1);
        
        // Sort notes by frequency
        let sorted = Object.keys(counts).sort((a,b) => counts[b] - counts[a]);
        
        // Basic heuristic: highest count note is often root.
        // We will just suggest a Major or Minor based on the Root for this prototype.
        let root = sorted[0];
        let hasMinorThird = counts[noteStrings[(noteStrings.indexOf(root) + 3) % 12]] > 0;
        
        currentSession.scale = root + (hasMinorThird ? " Minor" : " Major");
        scaleBox.textContent = currentSession.scale + " (Guessed)";
    }

    saveBtn.addEventListener('click', () => {
        let name = saveInput.value.trim();
        if (!name) {
            alert("Please enter a song name!");
            return;
        }
        if (currentSession.notes.length === 0 && currentSession.lyrics === '') {
            alert("No data to save. Please record first.");
            return;
        }

        let record = {
            id: Date.now(),
            name: name,
            scale: currentSession.scale,
            lyrics: currentSession.lyrics,
            notes: currentSession.notes,
            date: new Date().toLocaleString()
        };

        history.push(record);
        localStorage.setItem('casio_song_history', JSON.stringify(history));
        
        saveInput.value = '';
        renderHistory();
        alert("Song saved to history!");
    });

    clearBtn.addEventListener('click', () => {
        currentSession = { lyrics: '', notes: [], scale: 'Detecting...' };
        lyricsBox.innerHTML = '<i>Waiting for speech...</i>';
        notesBox.innerHTML = '';
        scaleBox.textContent = 'Detecting...';
        saveInput.value = '';
        statusText.textContent = "Cleared. Ready for next song.";
    });

    exportBtn.addEventListener('click', () => {
        let name = saveInput.value.trim() || "Unknown_Song";
        let content = `Song Name: ${name}\n`;
        content += `Scale: ${currentSession.scale}\n\n`;
        content += `Lyrics:\n${currentSession.lyrics || "No lyrics"}\n\n`;
        content += `Notes Detected:\n${currentSession.notes.join(' ')}\n`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}_notes.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    function renderHistory() {
        historyList.innerHTML = '';
        history.forEach((item, index) => {
            let div = document.createElement('div');
            div.className = 'history-item';
            div.style.position = 'relative';
            div.innerHTML = `
                <div style="font-weight: bold; color: #11998e; padding-right: 25px; word-wrap: break-word;">${item.name}</div>
                <div style="font-size: 12px; color: #aaa;">Scale: ${item.scale}</div>
                <div style="font-size: 11px; color: #666;">${item.date}</div>
                <button class="delete-history-btn" title="Delete Song" style="position: absolute; top: 8px; right: 5px; background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 16px; opacity: 0.8; transition: opacity 0.2s;">🗑️</button>
            `;
            
            const delBtn = div.querySelector('.delete-history-btn');
            delBtn.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
            delBtn.addEventListener('mouseleave', () => delBtn.style.opacity = '0.8');

            div.addEventListener('click', (e) => {
                if (e.target.closest('.delete-history-btn')) {
                    e.stopPropagation();
                    deleteHistoryItem(index);
                } else {
                    loadHistoryItem(item);
                }
            });
            historyList.appendChild(div);
        });
    }

    function deleteHistoryItem(index) {
        if (confirm("Are you sure you want to delete this song from history?")) {
            history.splice(index, 1);
            localStorage.setItem('casio_song_history', JSON.stringify(history));
            renderHistory();
        }
    }

    function loadHistoryItem(item) {
        statusText.textContent = "Viewing History: " + item.name;
        lyricsBox.innerHTML = item.lyrics || "<i>No lyrics detected</i>";
        scaleBox.textContent = item.scale;
        
        notesBox.innerHTML = '';
        item.notes.forEach(n => {
            let badge = document.createElement('span');
            badge.className = 'note-badge';
            badge.textContent = n;
            notesBox.appendChild(badge);
        });

        // Set the session and input so it can be exported
        saveInput.value = item.name;
        currentSession = {
            lyrics: item.lyrics,
            notes: item.notes,
            scale: item.scale
        };
    }
});
