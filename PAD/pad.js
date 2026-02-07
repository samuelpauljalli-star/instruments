const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);
masterGain.gain.value = 0.5;

// Data Structures
const KITS = {
    drums: {
        id: "P001",
        name: "Standard Drums",
        sounds: {
            1: { type: 'kick', label: 'KICK' },
            2: { type: 'snare', label: 'SNARE' },
            3: { type: 'hihat', label: 'H-HAT' },
            4: { type: 'tom', freq: 150, label: 'LOW TOM' },
            5: { type: 'tom', freq: 250, label: 'MID TOM' },
            6: { type: 'crash', label: 'CRASH' },
            7: { type: 'kick', label: 'KICK 2' },
            8: { type: 'snare', label: 'RIMSHOT' },
            9: { type: 'hihat_open', label: 'OPEN HH' },
            10: { type: 'cowbell', label: 'COWBELL' },
            11: { type: 'clap', label: 'CLAP' },
            12: { type: 'shaker', label: 'SHAKER' }
        }
    },
    tabla: {
        id: "P002",
        name: "Indian Tabla",
        sounds: {
            1: { type: 'tabla_dayan', freq: 300, label: 'NA' },
            2: { type: 'tabla_dayan', freq: 200, label: 'TUN' },
            3: { type: 'tabla_bayan', freq: 80, label: 'GHE' },
            4: { type: 'tabla_bayan', freq: 110, label: 'DHIN' },
            5: { type: 'tabla_dayan', freq: 400, label: 'TI' },
            6: { type: 'tabla_dayan', freq: 250, label: 'TA' },
            7: { type: 'tabla_dayan', freq: 350, label: 'RE' },
            8: { type: 'tabla_dayan', freq: 220, label: 'DIN' },
            9: { type: 'tabla_bayan', freq: 90, label: 'DA' }
        }
    },
    dholak: {
        id: "P003",
        name: "Dholak",
        sounds: {
            1: { type: 'dholak_bass', freq: 70, label: 'BASS' },
            2: { type: 'dholak_high', freq: 450, label: 'CHATI' },
            3: { type: 'dholak_high', freq: 350, label: 'THAP' },
            4: { type: 'dholak_bass', freq: 90, label: 'B-SLIDE' },
            5: { type: 'dholak_high', freq: 500, label: 'NA' }
        }
    },
    jazz: {
        id: "P004",
        name: "Jazz Kit",
        sounds: {
            1: { type: 'kick', freq: 60, label: 'J-KICK' },
            2: { type: 'snare', freq: 200, label: 'J-SNARE' },
            3: { type: 'hihat', label: 'J-BRUSH' },
            10: { type: 'ride', label: 'RIDE' },
            11: { type: 'ride_bell', label: 'R-BELL' },
            12: { type: 'jazz_acc', label: 'ACCENT' }
        }
    },
    synth: {
        id: "P003",
        name: "808 Synth",
        sounds: {
            1: { type: 'kick_long', label: '808 BASS' },
            2: { type: 'snare_synth', label: 'E-SNARE' },
            3: { type: 'hihat_synth', label: 'E-HAT' }
        }
    },
    fx: {
        id: "P004",
        name: "Dubstep FX",
        sounds: {
            1: { type: 'wobble', label: 'WOBBLE' },
            2: { type: 'laser', label: 'LASER' },
            3: { type: 'riser', label: 'RISER' }
        }
    }
};

let currentKitKey = 'drums';
let currentKit = KITS.drums;

// Features State
let isRecording = false;
let isLooping = false;
let recordedSequence = [];
let recordingStartTime = 0;
let loopTimeout = null;
let echoActive = false;

// Elements
const displayKit = document.getElementById('disp-kit');
const displayName = document.getElementById('disp-name');
const volKnob = document.getElementById('vol-knob');
const audioStart = document.getElementById('audio-start');

// Initialization
audioStart.onclick = () => {
    audioCtx.resume();
    audioStart.style.display = 'none';
};

// Sound Engines
const SoundEngine = {
    getBus: () => {
        if (!echoActive) return masterGain;
        const delay = audioCtx.createDelay();
        const feedback = audioCtx.createGain();
        delay.delayTime.value = 0.3;
        feedback.gain.value = 0.4;
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(masterGain);
        return delay;
    },
    kick: (t, freq = 50) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(freq + 100, t);
        osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(gain);
        gain.connect(SoundEngine.getBus());
        osc.start(t);
        osc.stop(t + 0.5);
    },
    snare: (t) => {
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < buf.length; i++) data[i] = Math.random() * 2 - 1;

        const noise = audioCtx.createBufferSource();
        noise.buffer = buf;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 800;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(t);

        // Snap component
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        const snapGain = audioCtx.createGain();
        snapGain.gain.setValueAtTime(0.5, t);
        snapGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc.connect(snapGain);
        snapGain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.05);
    },
    hihat: (t, decay = 0.05) => {
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < buf.length; i++) data[i] = Math.random() * 2 - 1;

        const noise = audioCtx.createBufferSource();
        noise.buffer = buf;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 8000;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + decay);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(t);
    },
    tom: (t, freq) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq / 2, t + 0.4);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.4);
    },
    crash: (t) => {
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < buf.length; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buf;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(t);
    },
    cowbell: (t) => {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc1.frequency.value = 800;
        osc2.frequency.value = 540;
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(masterGain);
        osc1.start(t); osc2.start(t);
        osc1.stop(t + 0.3); osc2.stop(t + 0.3);
    },
    clap: (t) => {
        for (let i = 0; i < 3; i++) {
            const delay = i * 0.01;
            const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let j = 0; j < buf.length; j++) data[j] = Math.random() * 2 - 1;
            const source = audioCtx.createBufferSource();
            source.buffer = buf;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass'; filter.frequency.value = 1200;
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.4, t + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.05);
            source.connect(filter); filter.connect(gain); gain.connect(masterGain);
            source.start(t + delay);
        }
    },
    tabla_dayan: (t, freq) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.9, t + 0.2);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(t); osc.stop(t + 0.2);
        // Add a sharp click
        const click = audioCtx.createOscillator();
        const clickGain = audioCtx.createGain();
        click.frequency.setValueAtTime(2000, t);
        clickGain.gain.setValueAtTime(0.3, t);
        clickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.01);
        click.connect(clickGain); clickGain.connect(masterGain);
        click.start(t); click.stop(t + 0.01);
    },
    tabla_bayan: (t, freq) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.4);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(t); osc.stop(t + 0.4);
    },
    dholak_bass: (t, freq) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(freq * 1.5, t);
        osc.frequency.exponentialRampToValueAtTime(freq, t + 0.5);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(t); osc.stop(t + 0.5);
    },
    dholak_high: (t, freq) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(t); osc.stop(t + 0.15);
    },
    play: (id, isAuto = false) => {
        const t = audioCtx.currentTime;
        const sound = currentKit.sounds[id] || KITS.drums.sounds[id];
        if (!sound) return;

        if (isRecording && !isAuto) {
            recordedSequence.push({
                id: id,
                time: t - recordingStartTime
            });
        }

        switch (sound.type) {
            case 'kick': SoundEngine.kick(t, sound.freq || 50); break;
            case 'snare': SoundEngine.snare(t); break;
            case 'hihat': SoundEngine.hihat(t); break;
            case 'hihat_open': SoundEngine.hihat(t, 0.5); break;
            case 'tom': SoundEngine.tom(t, sound.freq); break;
            case 'crash': SoundEngine.crash(t); break;
            case 'cowbell': SoundEngine.cowbell(t); break;
            case 'clap': SoundEngine.clap(t); break;
            case 'tabla_dayan': SoundEngine.tabla_dayan(t, sound.freq); break;
            case 'tabla_bayan': SoundEngine.tabla_bayan(t, sound.freq); break;
            case 'dholak_bass': SoundEngine.dholak_bass(t, sound.freq); break;
            case 'dholak_high': SoundEngine.dholak_high(t, sound.freq); break;
            case 'kick_long': SoundEngine.kick(t, 40); break;
            case 'snare_synth': SoundEngine.snare(t); break;
            case 'hihat_synth': SoundEngine.hihat(t, 0.02); break;
            default: SoundEngine.kick(t);
        }

        triggerVisualFeedback(id);
        triggerHitPulse();
    }
};

function triggerHitPulse() {
    document.body.classList.remove('hit');
    void document.body.offsetWidth;
    document.body.classList.add('hit');
    setTimeout(() => document.body.classList.remove('hit'), 150);
}

// UI Interactions
function triggerVisualFeedback(id) {
    const pad = document.querySelector(`.drum-pad[data-id="${id}"]`);
    if (pad) {
        pad.classList.remove('active');
        void pad.offsetWidth; // Trigger reflow
        pad.classList.add('active');
        setTimeout(() => pad.classList.remove('active'), 100);
    }
}

function updateKit(key) {
    currentKitKey = key;
    currentKit = KITS[key];
    displayKit.textContent = `KIT: ${currentKit.id}`;
    displayName.textContent = currentKit.name;

    // Update labels on large pads if available
    for (let i = 1; i <= 6; i++) {
        const pad = document.querySelector(`.drum-pad[data-id="${i}"]`);
        const label = pad.querySelector('.pad-label');
        if (label && currentKit.sounds[i]) {
            label.textContent = currentKit.sounds[i].label;
        }
    }

    document.body.setAttribute('data-kit', key);
    // Update chips
    document.querySelectorAll('.theme-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.kit === key);
    });
}

// Event Listeners
document.querySelectorAll('.drum-pad').forEach(pad => {
    pad.onmousedown = () => SoundEngine.play(pad.dataset.id);
    pad.ontouchstart = (e) => { e.preventDefault(); SoundEngine.play(pad.dataset.id); };
});

document.querySelectorAll('.theme-chip').forEach(chip => {
    chip.onclick = () => updateKit(chip.dataset.kit);
});

// Key Mapping
const KEY_MAP = {
    '7': 7, '8': 8, '9': 9,
    '4': 4, '5': 5, '6': 6,
    '1': 1, '2': 2, '3': 3,
    'v': 10, 'b': 11, 'n': 12,
    'V': 10, 'B': 11, 'N': 12
};

window.onkeydown = (e) => {
    if (KEY_MAP[e.key]) {
        SoundEngine.play(KEY_MAP[e.key]);
    }
    // Kit switching with Arrows
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') btnInc();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') btnDec();
};

// Nav buttons
function btnInc() {
    const keys = Object.keys(KITS);
    let idx = keys.indexOf(currentKitKey);
    idx = (idx + 1) % keys.length;
    updateKit(keys[idx]);
}

function btnDec() {
    const keys = Object.keys(KITS);
    let idx = keys.indexOf(currentKitKey);
    idx = (idx - 1 + keys.length) % keys.length;
    updateKit(keys[idx]);
}

document.getElementById('btn-inc').onclick = btnInc;
document.getElementById('btn-dec').onclick = btnDec;

// Volume Buttons
function updateVol(delta) {
    let currentVol = masterGain.gain.value + delta;
    currentVol = Math.max(0, Math.min(1, currentVol));
    masterGain.gain.value = currentVol;

    // Sync knob
    let deg = (currentVol * 270) - 135;
    volKnob.style.transform = `rotate(${deg}deg)`;
}

document.getElementById('vol-up').onclick = () => updateVol(0.1);
document.getElementById('vol-down').onclick = () => updateVol(-0.1);

// Feature Button Events
document.getElementById('btn-rec').onclick = (e) => {
    isRecording = !isRecording;
    if (isRecording) {
        recordedSequence = [];
        recordingStartTime = audioCtx.currentTime;
        e.target.classList.add('recording');
        displayName.textContent = "RECORDING...";
    } else {
        e.target.classList.remove('recording');
        displayName.textContent = "RECORDED (" + recordedSequence.length + " hits)";
    }
};

document.getElementById('btn-loop').onclick = (e) => {
    isLooping = !isLooping;
    e.target.classList.toggle('active', isLooping);
    if (isLooping && recordedSequence.length > 0) {
        playLoop();
    } else {
        clearTimeout(loopTimeout);
    }
};

document.getElementById('btn-echo').onclick = (e) => {
    echoActive = !echoActive;
    e.target.classList.toggle('active', echoActive);
};

function playLoop() {
    if (!isLooping || recordedSequence.length === 0) return;

    const startTimeActive = audioCtx.currentTime;
    recordedSequence.forEach(hit => {
        setTimeout(() => {
            if (isLooping) SoundEngine.play(hit.id, true);
        }, hit.time * 1000);
    });

    const totalDuration = recordedSequence[recordedSequence.length - 1].time + 1;
    loopTimeout = setTimeout(playLoop, totalDuration * 1000);
}

// Knob Rotation
let isDragging = false;
volKnob.onmousedown = () => isDragging = true;
window.onmouseup = () => isDragging = false;
window.onmousemove = (e) => {
    if (isDragging) {
        // Simple vertical drag for volume
        let rect = volKnob.getBoundingClientRect();
        let center = rect.top + rect.height / 2;
        let delta = (center - e.clientY) / 100;
        let currentVol = masterGain.gain.value + delta;
        currentVol = Math.max(0, Math.min(1, currentVol));
        masterGain.gain.value = currentVol;

        let deg = (currentVol * 270) - 135;
        volKnob.style.transform = `rotate(${deg}deg)`;
    }
};

// Set initial volume knob rotation
volKnob.style.transform = `rotate(0deg)`;
updateKit('drums');
