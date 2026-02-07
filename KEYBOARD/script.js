const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
const container = document.getElementById('keyboard-container');

// Ensure Audio Context is resumed
function resumeAudio() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log('Audio context resumed successfully');
            // Hide the audio prompt
            const audioPrompt = document.getElementById('audio-prompt');
            if (audioPrompt) {
                audioPrompt.classList.add('hidden');
            }
        });
    } else {
        // Audio is already running, just hide prompt
        const audioPrompt = document.getElementById('audio-prompt');
        if (audioPrompt) {
            audioPrompt.classList.add('hidden');
        }
    }
}

// Resume audio on any user interaction
document.addEventListener('click', resumeAudio, { once: false });
document.addEventListener('keydown', resumeAudio, { once: false });
document.addEventListener('touchstart', resumeAudio, { once: false });

// State
let state = {
    mode: 'voice',
    val: 0,
    tempo: 120,
    currentOctave: 2, // Default octave (1-5)
    rhythmPlaying: false,
    effects: { reverb: false, echo: false },
    vol: 0.8,
    isRecording: false,
    isLooping: false,
    recordedSequence: [],
    recordingStartTime: 0,
    loopTimeout: null
};

// Data
const VOICES = [
    { name: "GRAND PIANO", type: "triangle", decay: 1.5, sustain: 0.4, attack: 0.01 },
    { name: "BRIGHT PIANO", type: "sawtooth", filter: 2000, decay: 1.2, sustain: 0.5 },
    { name: "E.PIANO", type: "sine", fm: true, sustain: 0.6 },
    { name: "CHURCH ORGAN", type: "triangle", sustain: 0.8, attack: 0.1 },
    { name: "GUITAR", type: "sawtooth", attack: 0.05, decay: 0.5, sustain: 0.3 },
    { name: "VIOLIN", type: "sawtooth", attack: 0.4, sustain: 0.9 },
    { name: "SYNTH LEAD", type: "square", sustain: 0.8 },
    { name: "SAXOPHONE", type: "square", filter: 800, sustain: 0.7 },
    { name: "VIBES", type: "sine", fm: true, decay: 2, sustain: 0.5 },
    { name: "BASS", type: "triangle", attack: 0.02, decay: 0.4, sustain: 0.5 }
];

const STYLES = ["8-BEAT", "16-BEAT", "WALTZ", "DANCE", "DISCO", "ROCK", "SWING"];

// Keyboard mapping: White keys (C-C) and Black keys (C#, D#, F#, G#, A#)
const WHITE_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k']; // C, D, E, F, G, A, B, C
const BLACK_KEYS = ['w', 'e', 't', 'y', 'u']; // C#, D#, F#, G#, A#

// Note offsets for one octave (C to C)
const WHITE_NOTE_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12]; // C, D, E, F, G, A, B, C
const BLACK_NOTE_OFFSETS = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A#

// Elements
const dispVal = document.getElementById('disp-val');
const dispLabel = document.getElementById('disp-label');
const ledVoice = document.getElementById('led-voice');
const ledStyle = document.getElementById('led-style');
const ledSong = document.getElementById('led-song');

// Audio Graph
const masterGain = audioCtx.createGain();
const reverbBus = audioCtx.createConvolver();
const reverbGain = audioCtx.createGain();
const echoDelay = audioCtx.createDelay();
const echoGain = audioCtx.createGain();

reverbGain.gain.value = 0;
echoGain.gain.value = 0;
masterGain.gain.value = 0.8;

// Reverb Impulse
function buildImpulse() {
    const len = audioCtx.sampleRate * 2;
    const buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    reverbBus.buffer = buf;
}
buildImpulse();

// Connections
reverbBus.connect(reverbGain);
reverbGain.connect(masterGain);
echoDelay.connect(echoGain);
echoGain.connect(echoDelay);
echoGain.connect(masterGain);
masterGain.connect(audioCtx.destination);

// Controls Logic
function updateDisplay() {
    ledVoice.classList.toggle('active', state.mode === 'voice');
    ledStyle.classList.toggle('active', state.mode === 'style');
    ledSong.classList.toggle('active', state.mode === 'song');

    if (state.mode === 'voice') {
        const v = VOICES[state.val % VOICES.length];
        dispVal.textContent = (state.val % VOICES.length + 1).toString().padStart(3, '0');
        dispLabel.textContent = v.name;
    } else if (state.mode === 'style') {
        const s = STYLES[state.val % STYLES.length];
        dispVal.textContent = (state.val % STYLES.length + 101).toString().padStart(3, '0');
        dispLabel.textContent = s;
    } else {
        dispVal.textContent = state.tempo;
        dispLabel.textContent = "TEMPO";
    }

    // Update octave indicator
    updateOctaveDisplay();
}

function updateOctaveDisplay() {
    const octaveIndicator = document.getElementById('octave-indicator');
    if (octaveIndicator) {
        octaveIndicator.textContent = `OCTAVE ${state.currentOctave}`;
    }
}

document.getElementById('btn-voice').onclick = () => { state.mode = 'voice'; state.val = 0; updateDisplay(); };
document.getElementById('btn-style').onclick = () => { state.mode = 'style'; state.val = 0; updateDisplay(); };
document.getElementById('btn-song').onclick = () => { state.mode = 'song'; updateDisplay(); };

document.getElementById('btn-next').onclick = () => {
    if (state.mode === 'song') state.tempo = Math.min(280, state.tempo + 5);
    else state.val++;
    updateDisplay();
};
document.getElementById('btn-prev').onclick = () => {
    if (state.mode === 'song') state.tempo = Math.max(40, state.tempo - 5);
    else state.val = Math.max(0, state.val - 1);
    updateDisplay();
};

document.getElementById('btn-reverb').onclick = (e) => {
    state.effects.reverb = !state.effects.reverb;
    e.target.classList.toggle('on', state.effects.reverb);
    reverbGain.gain.value = state.effects.reverb ? 0.5 : 0;
};
document.getElementById('btn-echo').onclick = (e) => {
    state.effects.echo = !state.effects.echo;
    e.target.classList.toggle('on', state.effects.echo);
    echoGain.gain.value = state.effects.echo ? 0.3 : 0;
    echoDelay.delayTime.value = 60 / state.tempo * 0.5;
};

document.getElementById('master-vol').oninput = (e) => {
    masterGain.gain.value = e.target.value / 100;
};

// Keyboard Logic
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function initKeys() {
    container.innerHTML = ''; // Clear existing keys
    let whiteIndex = 0;

    for (let i = 0; i < 61; i++) {
        const note = NOTES[i % 12];
        const oct = 2 + Math.floor(i / 12);
        const freq = 440 * Math.pow(2, (i - 45) / 12);
        const isBlack = note.includes('#');

        const k = document.createElement('div');
        k.dataset.freq = freq;
        k.dataset.note = note;
        k.dataset.octave = oct;
        k.dataset.noteIndex = i;

        if (isBlack) {
            k.className = 'key black';
            k.style.left = (whiteIndex * 44 - 14) + 'px';

            // Add keyboard label for black keys
            const blackKeyIndex = [1, 3, 6, 8, 10].indexOf(i % 12);
            const keyLabel = blackKeyIndex >= 0 ? BLACK_KEYS[blackKeyIndex].toUpperCase() : '';
            k.innerHTML = `<div class="key-label"><div class="kb-label">${keyLabel}</div>${note}</div>`;
        } else {
            k.className = 'key white';

            // Add keyboard label for white keys
            const whiteNoteInOctave = [0, 2, 4, 5, 7, 9, 11, 12].indexOf(i % 12);
            const keyLabel = whiteNoteInOctave >= 0 && whiteNoteInOctave < WHITE_KEYS.length ?
                WHITE_KEYS[whiteNoteInOctave].toUpperCase() : '';
            k.innerHTML = `<div class="key-label"><div class="kb-label">${keyLabel}</div>${note}</div>`;
            whiteIndex++;
        }

        ['mousedown', 'touchstart'].forEach(evt =>
            k.addEventListener(evt, (e) => { e.preventDefault(); playNote(freq, k); resumeAudio(); })
        );
        ['mouseup', 'touchend', 'touchcancel'].forEach(evt =>
            k.addEventListener(evt, (e) => { e.preventDefault(); stopNote(freq, k); })
        );
        k.addEventListener('mouseleave', () => stopNote(freq, k));

        container.appendChild(k);
    }

    const keyboardWidth = whiteIndex * 44;
    document.querySelector('.piano-case').style.setProperty('--kb-width', keyboardWidth + 'px');
}

const activeOscs = {};
const activeKeys = new Set(); // Track currently pressed keyboard keys

function playNote(freq, el) {
    // Ensure audio context is running
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (el) el.classList.add('active');

    // Speakers Pulse
    document.querySelectorAll('.speaker-grill').forEach(s => {
        s.classList.remove('pulse');
        void s.offsetWidth;
        s.classList.add('pulse');
    });

    // Visualizer
    animateVisualizer(freq);

    // Recording and Visual Pulse
    if (state.isRecording) {
        state.recordedSequence.push({
            freq: freq,
            el: el ? el.dataset.noteIndex : null, // Store index for lookup
            time: audioCtx.currentTime - state.recordingStartTime
        });
    }
    triggerHitPulse();

    const voice = VOICES[state.val % VOICES.length];
    const t = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    osc.type = voice.type;
    osc.frequency.value = freq;

    if (voice.fm) {
        const mod = audioCtx.createOscillator();
        const mg = audioCtx.createGain();
        mod.frequency.value = freq * 2;
        mg.gain.value = 300;
        mod.connect(mg);
        mg.connect(osc.frequency);
        mod.start(t);
    }

    osc.connect(g);
    g.connect(masterGain);
    if (state.effects.reverb) osc.connect(reverbBus);
    if (state.effects.echo) osc.connect(echoDelay);

    const atk = voice.attack || 0.02;
    const dec = voice.decay || 0.5;
    const sus = (voice.sustain !== undefined) ? voice.sustain : 0.6;

    // Ensure sustain is at least 0.3 for audibility
    const sustainLevel = Math.max(sus, 0.3);

    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.8, t + atk); // Increased from 1 to 0.8 for safety
    g.gain.exponentialRampToValueAtTime(sustainLevel, t + atk + dec);

    osc.start(t);
    activeOscs[freq] = { osc, g, voice };

    console.log(`Playing: ${freq.toFixed(2)}Hz, Voice: ${voice.name}, AudioContext: ${audioCtx.state}, Master Volume: ${masterGain.gain.value}`);
}

function stopNote(freq, el) {
    if (el) el.classList.remove('active');
    const o = activeOscs[freq];
    if (!o) return;

    const t = audioCtx.currentTime;
    o.g.gain.cancelScheduledValues(t);
    o.g.gain.setValueAtTime(o.g.gain.value, t);
    o.g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.osc.stop(t + 0.1);
    delete activeOscs[freq];
}

function animateVisualizer(freq) {
    const bars = document.querySelectorAll('.bar');
    const center = Math.floor(Math.random() * bars.length);
    if (bars[center]) {
        bars[center].classList.add('lit');
        bars[center].style.height = '15px';
        setTimeout(() => {
            bars[center].classList.remove('lit');
            bars[center].style.height = '4px';
        }, 100);
    }
}

function triggerHitPulse() {
    document.body.classList.remove('hit');
    void document.body.offsetWidth;
    document.body.classList.add('hit');
    setTimeout(() => document.body.classList.remove('hit'), 150);
}

// Computer Keyboard Input
function getNoteFromKey(key) {
    const whiteIndex = WHITE_KEYS.indexOf(key.toLowerCase());
    const blackIndex = BLACK_KEYS.indexOf(key.toLowerCase());

    if (whiteIndex >= 0) {
        return {
            offset: WHITE_NOTE_OFFSETS[whiteIndex],
            isBlack: false
        };
    } else if (blackIndex >= 0) {
        return {
            offset: BLACK_NOTE_OFFSETS[blackIndex],
            isBlack: true
        };
    }
    return null;
}

function getFrequencyForNote(noteOffset, userOctave) {
    // User octaves: 1-5
    // Piano octaves in our keyboard: 2-6 (61 keys starting from C2)
    // Map user octave 1-5 to piano octave 2-6
    const pianoOctave = userOctave + 1;

    // Calculate MIDI note number
    // C0 = MIDI 12, C1 = MIDI 24, C2 = MIDI 36, etc.
    // A4 (440Hz) = MIDI 69
    const midiNote = (pianoOctave * 12) + noteOffset;
    const A4_MIDI = 69;
    const frequency = 440 * Math.pow(2, (midiNote - A4_MIDI) / 12);

    return frequency;
}

function findKeyElement(noteOffset, userOctave) {
    const keys = document.querySelectorAll('.key');
    const targetNote = NOTES[noteOffset];
    const pianoOctave = userOctave + 1; // Map to piano octave

    for (let key of keys) {
        if (key.dataset.note === targetNote && parseInt(key.dataset.octave) === pianoOctave) {
            return key;
        }
    }
    return null;
}

window.addEventListener('keydown', e => {
    if (e.repeat) return;

    // Octave switching (1-5 keys)
    if (e.key >= '1' && e.key <= '5') {
        state.currentOctave = parseInt(e.key);
        updateOctaveDisplay();

        // Visual feedback
        const octaveButtons = document.querySelectorAll('.octave-btn');
        octaveButtons.forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.octave-btn[data-octave="${e.key}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        return;
    }

    const noteInfo = getNoteFromKey(e.key);
    if (noteInfo && !activeKeys.has(e.key.toLowerCase())) {
        activeKeys.add(e.key.toLowerCase());
        const freq = getFrequencyForNote(noteInfo.offset, state.currentOctave);
        const keyElement = findKeyElement(noteInfo.offset, state.currentOctave);
        playNote(freq, keyElement);
    }
});

window.addEventListener('keyup', e => {
    const noteInfo = getNoteFromKey(e.key);
    if (noteInfo) {
        activeKeys.delete(e.key.toLowerCase());
        const freq = getFrequencyForNote(noteInfo.offset, state.currentOctave);
        const keyElement = findKeyElement(noteInfo.offset, state.currentOctave);
        stopNote(freq, keyElement);
    }
});

// Keyboard Guide Toggle
const guideToggle = document.getElementById('guide-toggle');
const guideOverlay = document.getElementById('keyboard-guide');
const guideClose = document.getElementById('guide-close');

if (guideToggle && guideOverlay && guideClose) {
    guideToggle.addEventListener('click', () => {
        guideOverlay.classList.add('active');
    });

    guideClose.addEventListener('click', () => {
        guideOverlay.classList.remove('active');
    });

    guideOverlay.addEventListener('click', (e) => {
        if (e.target === guideOverlay) {
            guideOverlay.classList.remove('active');
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && guideOverlay.classList.contains('active')) {
            guideOverlay.classList.remove('active');
        }
    });
}

// Octave Button Click Handlers
const octaveButtons = document.querySelectorAll('.octave-btn');
octaveButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const octave = parseInt(btn.dataset.octave);
        state.currentOctave = octave;
        updateOctaveDisplay();

        // Update active state
        octaveButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Feature Button Click Handlers
document.getElementById('btn-rec').onclick = (e) => {
    state.isRecording = !state.isRecording;
    if (state.isRecording) {
        state.recordedSequence = [];
        state.recordingStartTime = audioCtx.currentTime;
        e.target.classList.add('active');
        dispLabel.textContent = "RECORDING...";
    } else {
        e.target.classList.remove('active');
        dispLabel.textContent = "RECORDED";
    }
};

document.getElementById('btn-loop').onclick = (e) => {
    state.isLooping = !state.isLooping;
    e.target.classList.toggle('active', state.isLooping);
    if (state.isLooping && state.recordedSequence.length > 0) {
        playLoop();
    } else {
        clearTimeout(state.loopTimeout);
    }
};

function playLoop() {
    if (!state.isLooping || state.recordedSequence.length === 0) return;

    state.recordedSequence.forEach(hit => {
        setTimeout(() => {
            if (state.isLooping) {
                const keyEl = hit.el !== null ? document.querySelector(`.key[data-note-index="${hit.el}"]`) : null;
                playNote(hit.freq, keyEl);
                setTimeout(() => stopNote(hit.freq, keyEl), 200);
            }
        }, hit.time * 1000);
    });

    const lastHit = state.recordedSequence[state.recordedSequence.length - 1];
    const duration = lastHit.time + 1;
    state.loopTimeout = setTimeout(playLoop, duration * 1000);
}

// Boot
initKeys();
updateDisplay();
