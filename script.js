// Мобильная консоль для отладки
(function() {
    const mobileConsole = document.getElementById('mobileConsole');
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobileDevice) return; // Показываем только на мобильных

    let logCount = 0;
    const maxLogs = 50;

    function addLog(message, type = 'log') {
        if (!mobileConsole) return;

        const logEntry = document.createElement('div');
        logEntry.className = type;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;

        mobileConsole.appendChild(logEntry);
        logCount++;

        // Ограничиваем количество логов
        if (logCount > maxLogs) {
            mobileConsole.removeChild(mobileConsole.firstChild);
            logCount--;
        }

        // Автоскролл вниз
        mobileConsole.scrollTop = mobileConsole.scrollHeight;

        // Показываем консоль
        mobileConsole.classList.add('visible');
    }

    // Перехват console.log
    const originalLog = console.log;
    console.log = function(...args) {
        originalLog.apply(console, args);
        addLog(args.join(' '), 'log');
    };

    // Перехват console.error
    const originalError = console.error;
    console.error = function(...args) {
        originalError.apply(console, args);
        addLog('ERROR: ' + args.join(' '), 'error');
    };

    // Перехват console.warn
    const originalWarn = console.warn;
    console.warn = function(...args) {
        originalWarn.apply(console, args);
        addLog('WARN: ' + args.join(' '), 'warn');
    };

    // Перехват необработанных ошибок
    window.addEventListener('error', function(e) {
        addLog(`ERROR: ${e.message} at ${e.filename}:${e.lineno}`, 'error');
    });

    // Перехват необработанных промисов
    window.addEventListener('unhandledrejection', function(e) {
        addLog(`PROMISE ERROR: ${e.reason}`, 'error');
    });

    console.log('Mobile console initialized');
})();

// Элементы DOM
const videoElement = document.getElementById('video');
const drawingCanvas = document.getElementById('drawingCanvas');
const handCanvas = document.getElementById('handCanvas');
const drawingCtx = drawingCanvas.getContext('2d');
const handCtx = handCanvas.getContext('2d');
const statusElement = document.getElementById('status');
const clearBtn = document.getElementById('clearBtn');
const audioBtn = document.getElementById('audioBtn');
const melodySelect = document.getElementById('melodySelect');
const playSelectedBtn = document.getElementById('playSelectedBtn');
const instrumentSelect = document.getElementById('instrumentSelect');
const octaveUpBtn = document.getElementById('octaveUp');
const octaveDownBtn = document.getElementById('octaveDown');
const octaveValueElement = document.getElementById('octaveValue');
const colorPicker = document.getElementById('colorPicker');

// Debug info elements
const indexCoordsElement = document.getElementById('indexCoords');
const thumbCoordsElement = document.getElementById('thumbCoords');
const distanceElement = document.getElementById('distance');
const depthElement = document.getElementById('depth');
const pinchStatusElement = document.getElementById('pinchStatus');
const frequencyElement = document.getElementById('frequency');

// Проверка элементов
if (!indexCoordsElement) console.error('indexCoords element not found');
if (!thumbCoordsElement) console.error('thumbCoords element not found');
if (!distanceElement) console.error('distance element not found');
if (!depthElement) console.error('depth element not found');
if (!pinchStatusElement) console.error('pinchStatus element not found');
if (!frequencyElement) console.error('frequency element not found');

// Настройки рисования
let drawingColor = '#ff0000';
let lineWidth = 1;
let isDrawing = false;
let lastPoint = null;
let octaveShift = 0; // Смещение октавы (-2 до +2)
let lastOctaveChangeTime = 0; // Время последнего изменения октавы
const OCTAVE_CHANGE_COOLDOWN = 500; // Задержка между изменениями октавы (мс)

// Web Audio API для звука
let audioContext = null;
let oscillator = null;
let oscillators = []; // Массив осцилляторов для сложных инструментов
let gainNode = null;
let vibratoOsc = null; // Осциллятор для вибрато
let vibratoGain = null;
let noiseNode = null; // Генератор шума для флейты
let isAudioPlaying = false;
let isAudioEnabled = true; // Звук включен по умолчанию
let currentInstrument = 'flute1'; // По умолчанию классическая флейта

// Tone.js синтезаторы
let toneSynth = null;
let toneVolume = null;
let useToneJS = false; // Флаг использования Tone.js

// Инициализация аудио контекста
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = 0.3; // Громкость 30%
    }

    // Инициализация Tone.js
    if (!toneVolume) {
        toneVolume = new Tone.Volume(-12).toDestination();
    }
}

// Создание Tone.js синтезатора
function createToneSynth(instrument) {
    if (toneSynth) {
        toneSynth.dispose();
        toneSynth = null;
    }

    switch(instrument) {
        case 'epiano':
            toneSynth = new Tone.FMSynth({
                harmonicity: 3,
                modulationIndex: 10,
                oscillator: { type: 'sine' },
                envelope: { attack: 0.01, decay: 0.5, sustain: 0.3, release: 1 },
                modulation: { type: 'square' },
                modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.5 }
            }).connect(toneVolume);
            break;

        case 'eguitar':
            toneSynth = new Tone.PluckSynth({
                attackNoise: 1,
                dampening: 3000,
                resonance: 0.92
            }).connect(toneVolume);
            break;

        case 'bass':
            toneSynth = new Tone.MonoSynth({
                oscillator: { type: 'square' },
                filter: { Q: 2, type: 'lowpass', rolloff: -24 },
                envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.8 },
                filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 2, baseFrequency: 50, octaves: 2.6 }
            }).connect(toneVolume);
            break;

        case 'trumpet':
            toneSynth = new Tone.FMSynth({
                harmonicity: 1.5,
                modulationIndex: 12,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.05, decay: 0.3, sustain: 0.8, release: 0.3 },
                modulation: { type: 'square' },
                modulationEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.3 }
            }).connect(toneVolume);
            break;

        case 'saxophone':
            toneSynth = new Tone.AMSynth({
                harmonicity: 2.5,
                oscillator: { type: 'amsawtooth' },
                envelope: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.7 },
                modulation: { type: 'square' },
                modulationEnvelope: { attack: 0.3, decay: 0.2, sustain: 0.5, release: 0.7 }
            }).connect(toneVolume);
            break;

        case 'organ':
            toneSynth = new Tone.FatOscillator('C2', 'sawtooth', 40).connect(
                new Tone.Filter(2000, 'lowpass').connect(toneVolume)
            );
            toneSynth.start();
            break;

        case 'vibraphone':
            toneSynth = new Tone.FMSynth({
                harmonicity: 3.01,
                modulationIndex: 14,
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.001, decay: 2, sustain: 0.1, release: 2 },
                modulation: { type: 'square' },
                modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.5 }
            }).connect(toneVolume);
            break;

        case 'marimba':
            toneSynth = new Tone.MembraneSynth({
                pitchDecay: 0.05,
                octaves: 6,
                oscillator: { type: 'sine' },
                envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4, attackCurve: 'exponential' }
            }).connect(toneVolume);
            break;

        case 'bells':
            toneSynth = new Tone.MetalSynth({
                frequency: 200,
                envelope: { attack: 0.001, decay: 1.4, release: 0.2 },
                harmonicity: 5.1,
                modulationIndex: 32,
                resonance: 4000,
                octaves: 1.5
            }).connect(toneVolume);
            break;

        default:
            toneSynth = new Tone.Synth().connect(toneVolume);
    }
}

// Создание белого шума
function createNoiseBuffer() {
    const bufferSize = audioContext.sampleRate * 2;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    return buffer;
}

// Запуск звука
function startSound(frequency, volume) {
    if (!isAudioEnabled) return; // Если звук выключен, не воспроизводим
    if (!audioContext) initAudio();

    // Определяем, использовать ли Tone.js
    const toneJSInstruments = ['epiano', 'eguitar', 'bass', 'trumpet', 'saxophone', 'organ', 'vibraphone', 'marimba', 'bells'];
    useToneJS = toneJSInstruments.includes(currentInstrument);

    if (useToneJS) {
        // Используем Tone.js
        if (!isAudioPlaying) {
            createToneSynth(currentInstrument);
            isAudioPlaying = true;
        }

        if (toneSynth) {
            const note = Tone.Frequency(frequency, "hz").toNote();

            // Устанавливаем громкость
            if (toneVolume) {
                const db = Tone.gainToDb(volume);
                toneVolume.volume.rampTo(db, 0.05);
            }

            // Для органа меняем частоту напрямую
            if (currentInstrument === 'organ') {
                toneSynth.frequency.setValueAtTime(frequency, Tone.now());
            } else {
                // Для других инструментов используем triggerAttack/triggerRelease
                if (!toneSynth._isPlaying) {
                    toneSynth.triggerAttack(note);
                    toneSynth._isPlaying = true;
                } else {
                    // Плавно меняем частоту
                    toneSynth.frequency.rampTo(frequency, 0.01);
                }
            }
        }

        return; // Выходим, не используя Web Audio API
    }

    // Используем Web Audio API для остальных инструментов

    if (!isAudioPlaying) {
        oscillators = []; // Очищаем массив

        // Сбрасываем громкость gainNode (после stopSound он остается на 0.0001)
        if (gainNode) {
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        }

        if (currentInstrument === 'flute1') {
            // Флейта классическая - чистый синус
            oscillator = audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;
            oscillator.connect(gainNode);
            oscillator.start();

        } else if (currentInstrument === 'flute2') {
            // Флейта с вибрато
            oscillator = audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;

            // Создаем вибрато (LFO)
            vibratoOsc = audioContext.createOscillator();
            vibratoOsc.type = 'sine';
            vibratoOsc.frequency.value = 5; // 5 Hz вибрато
            vibratoGain = audioContext.createGain();
            vibratoGain.gain.value = 10; // Глубина вибрато

            vibratoOsc.connect(vibratoGain);
            vibratoGain.connect(oscillator.frequency);
            oscillator.connect(gainNode);

            vibratoOsc.start();
            oscillator.start();

        } else if (currentInstrument === 'theremin') {
            // Терменвокс - характерный электронный звук с сильным вибрато
            oscillator = audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;

            // Сильное вибрато для терменвокса
            vibratoOsc = audioContext.createOscillator();
            vibratoOsc.type = 'sine';
            vibratoOsc.frequency.value = 5.5; // 5.5 Hz вибрато
            vibratoGain = audioContext.createGain();
            vibratoGain.gain.value = 15; // Глубокое вибрато

            vibratoOsc.connect(vibratoGain);
            vibratoGain.connect(oscillator.frequency);

            // Плавное изменение частоты (portamento)
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

            oscillator.connect(gainNode);

            vibratoOsc.start();
            oscillator.start();

        } else if (currentInstrument === 'flute3') {
            // Флейта воздушная - синус + шум
            oscillator = audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;

            const oscGain = audioContext.createGain();
            oscGain.gain.value = 0.7;

            // Добавляем шум
            noiseNode = audioContext.createBufferSource();
            noiseNode.buffer = createNoiseBuffer();
            noiseNode.loop = true;

            const noiseFilter = audioContext.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.value = frequency;
            noiseFilter.Q.value = 5;

            const noiseGain = audioContext.createGain();
            noiseGain.gain.value = 0.05; // Слабый шум

            noiseNode.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(gainNode);

            oscillator.connect(oscGain);
            oscGain.connect(gainNode);

            noiseNode.start();
            oscillator.start();

        } else if (currentInstrument === 'piano') {
            // Пианино - несколько гармоник с огибающей
            const harmonics = [
                { ratio: 1, gain: 1.0 },
                { ratio: 2, gain: 0.5 },
                { ratio: 3, gain: 0.25 },
                { ratio: 4, gain: 0.15 },
                { ratio: 5, gain: 0.1 }
            ];

            harmonics.forEach(h => {
                const osc = audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = frequency * h.ratio;

                const harmGain = audioContext.createGain();
                harmGain.gain.value = h.gain * 0.15;

                osc.connect(harmGain);
                harmGain.connect(gainNode);
                osc.start();

                oscillators.push({ osc, gain: harmGain });
            });

        } else if (currentInstrument === 'violin') {
            // Скрипка - яркие гармоники с вибрато
            oscillator = audioContext.createOscillator();
            oscillator.type = 'sawtooth';
            oscillator.frequency.value = frequency;

            // Вибрато для скрипки
            vibratoOsc = audioContext.createOscillator();
            vibratoOsc.type = 'sine';
            vibratoOsc.frequency.value = 6; // 6 Hz вибрато
            vibratoGain = audioContext.createGain();
            vibratoGain.gain.value = 8;

            vibratoOsc.connect(vibratoGain);
            vibratoGain.connect(oscillator.frequency);

            // Фильтр для яркости
            const filter = audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = frequency * 4;
            filter.Q.value = 1;

            oscillator.connect(filter);
            filter.connect(gainNode);

            vibratoOsc.start();
            oscillator.start();

        } else if (currentInstrument === 'cello') {
            // Виолончель - богатые низкие гармоники
            const harmonics = [
                { ratio: 1, gain: 1.0 },
                { ratio: 2, gain: 0.7 },
                { ratio: 3, gain: 0.4 },
                { ratio: 4, gain: 0.2 }
            ];

            harmonics.forEach(h => {
                const osc = audioContext.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = frequency * h.ratio;

                const harmGain = audioContext.createGain();
                harmGain.gain.value = h.gain * 0.2;

                osc.connect(harmGain);
                harmGain.connect(gainNode);
                osc.start();

                oscillators.push({ osc, gain: harmGain });
            });

        } else if (currentInstrument === 'guitar') {
            // Гитара - треугольная волна с затуханием
            const harmonics = [
                { ratio: 1, gain: 1.0, type: 'triangle' },
                { ratio: 2, gain: 0.3, type: 'triangle' },
                { ratio: 3, gain: 0.15, type: 'sine' }
            ];

            harmonics.forEach(h => {
                const osc = audioContext.createOscillator();
                osc.type = h.type;
                osc.frequency.value = frequency * h.ratio;

                const harmGain = audioContext.createGain();
                harmGain.gain.value = h.gain * 0.25;

                osc.connect(harmGain);
                harmGain.connect(gainNode);
                osc.start();

                oscillators.push({ osc, gain: harmGain });
            });

        } else if (currentInstrument === 'clarinet') {
            // Кларнет - нечетные гармоники (квадратная волна + фильтр)
            oscillator = audioContext.createOscillator();
            oscillator.type = 'square';
            oscillator.frequency.value = frequency;

            const filter = audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = frequency * 3;
            filter.Q.value = 2;

            oscillator.connect(filter);
            filter.connect(gainNode);
            oscillator.start();

        } else if (currentInstrument === 'panflute') {
            // Флейта Пана - мягкие воздушные звуки с легким шумом
            oscillator = audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;

            const osc2 = audioContext.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.value = frequency * 2.01; // Слегка расстроенная гармоника для хора

            const gain1 = audioContext.createGain();
            const gain2 = audioContext.createGain();
            gain1.gain.value = 0.6;
            gain2.gain.value = 0.2;

            oscillator.connect(gain1);
            osc2.connect(gain2);
            gain1.connect(gainNode);
            gain2.connect(gainNode);

            oscillator.start();
            osc2.start();

            oscillators.push({ osc: osc2, gain: gain2 });

        } else if (currentInstrument === 'recorder') {
            // Блокфлейта - мягкий звук с малым количеством гармоник
            oscillator = audioContext.createOscillator();
            oscillator.type = 'triangle';
            oscillator.frequency.value = frequency;

            const filter = audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = frequency * 3;
            filter.Q.value = 1;

            oscillator.connect(filter);
            filter.connect(gainNode);
            oscillator.start();

        } else if (currentInstrument === 'ukulele') {
            // Укулеле - мягче гитары, светлый тембр
            const harmonics = [
                { ratio: 1, gain: 1.0, type: 'triangle' },
                { ratio: 2, gain: 0.4, type: 'sine' },
                { ratio: 3, gain: 0.2, type: 'sine' }
            ];

            harmonics.forEach(h => {
                const osc = audioContext.createOscillator();
                osc.type = h.type;
                osc.frequency.value = frequency * h.ratio;

                const harmGain = audioContext.createGain();
                harmGain.gain.value = h.gain * 0.3;

                osc.connect(harmGain);
                harmGain.connect(gainNode);
                osc.start();

                oscillators.push({ osc, gain: harmGain });
            });

        } else if (currentInstrument === 'xylophone') {
            // Ксилофон - короткие деревянные звуки
            const harmonics = [
                { ratio: 1, gain: 1.0 },
                { ratio: 2.76, gain: 0.4 }, // Несинхронные гармоники для дерева
                { ratio: 5.40, gain: 0.2 },
                { ratio: 8.93, gain: 0.1 }
            ];

            harmonics.forEach(h => {
                const osc = audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = frequency * h.ratio;

                const harmGain = audioContext.createGain();
                harmGain.gain.value = h.gain * 0.15;

                osc.connect(harmGain);
                harmGain.connect(gainNode);
                osc.start();

                oscillators.push({ osc, gain: harmGain });
            });

        } else if (currentInstrument === 'glockenspiel') {
            // Глокеншпиль - яркие металлические звуки
            const harmonics = [
                { ratio: 1, gain: 1.0 },
                { ratio: 2.76, gain: 0.6 },
                { ratio: 5.40, gain: 0.4 },
                { ratio: 8.93, gain: 0.25 },
                { ratio: 13.34, gain: 0.15 }
            ];

            harmonics.forEach(h => {
                const osc = audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = frequency * h.ratio;

                const harmGain = audioContext.createGain();
                harmGain.gain.value = h.gain * 0.12;

                // Добавляем легкое вибрато для металлического звона
                const vibrato = audioContext.createOscillator();
                vibrato.type = 'sine';
                vibrato.frequency.value = 4;
                const vibratoGain = audioContext.createGain();
                vibratoGain.gain.value = 2;
                vibrato.connect(vibratoGain);
                vibratoGain.connect(osc.frequency);
                vibrato.start();

                osc.connect(harmGain);
                harmGain.connect(gainNode);
                osc.start();

                oscillators.push({ osc, gain: harmGain });
            });

        } else if (currentInstrument === 'harp') {
            // Арфа - чистые гармоники с быстрым затуханием
            const harmonics = [
                { ratio: 1, gain: 1.0 },
                { ratio: 2, gain: 0.6 },
                { ratio: 3, gain: 0.3 },
                { ratio: 4, gain: 0.15 },
                { ratio: 5, gain: 0.08 },
                { ratio: 6, gain: 0.04 }
            ];

            harmonics.forEach(h => {
                const osc = audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = frequency * h.ratio;

                const harmGain = audioContext.createGain();
                harmGain.gain.value = h.gain * 0.12;

                osc.connect(harmGain);
                harmGain.connect(gainNode);
                osc.start();

                oscillators.push({ osc, gain: harmGain });
            });
        }

        isAudioPlaying = true;
    } else {
        // Плавно меняем частоту
        if (oscillator) {
            // Терменвокс требует более плавного портаменто
            if (currentInstrument === 'theremin') {
                oscillator.frequency.exponentialRampToValueAtTime(frequency, audioContext.currentTime + 0.05);
            } else {
                oscillator.frequency.setTargetAtTime(frequency, audioContext.currentTime, 0.01);
            }
        }

        // Обновляем частоту для всех гармоник
        if (currentInstrument === 'piano') {
            const harmonicRatios = [1, 2, 3, 4, 5];
            oscillators.forEach((item, i) => {
                item.osc.frequency.setTargetAtTime(frequency * harmonicRatios[i], audioContext.currentTime, 0.01);
            });
        } else if (currentInstrument === 'cello') {
            const harmonicRatios = [1, 2, 3, 4];
            oscillators.forEach((item, i) => {
                item.osc.frequency.setTargetAtTime(frequency * harmonicRatios[i], audioContext.currentTime, 0.01);
            });
        } else if (currentInstrument === 'guitar') {
            const harmonicRatios = [1, 2, 3];
            oscillators.forEach((item, i) => {
                item.osc.frequency.setTargetAtTime(frequency * harmonicRatios[i], audioContext.currentTime, 0.01);
            });
        } else if (currentInstrument === 'ukulele') {
            const harmonicRatios = [1, 2, 3];
            oscillators.forEach((item, i) => {
                item.osc.frequency.setTargetAtTime(frequency * harmonicRatios[i], audioContext.currentTime, 0.01);
            });
        } else if (currentInstrument === 'harp') {
            const harmonicRatios = [1, 2, 3, 4, 5, 6];
            oscillators.forEach((item, i) => {
                item.osc.frequency.setTargetAtTime(frequency * harmonicRatios[i], audioContext.currentTime, 0.01);
            });
        } else if (currentInstrument === 'xylophone') {
            const harmonicRatios = [1, 2.76, 5.40, 8.93];
            oscillators.forEach((item, i) => {
                item.osc.frequency.setTargetAtTime(frequency * harmonicRatios[i], audioContext.currentTime, 0.01);
            });
        } else if (currentInstrument === 'glockenspiel') {
            const harmonicRatios = [1, 2.76, 5.40, 8.93, 13.34];
            oscillators.forEach((item, i) => {
                item.osc.frequency.setTargetAtTime(frequency * harmonicRatios[i], audioContext.currentTime, 0.01);
            });
        } else if (currentInstrument === 'panflute') {
            // Обновляем второй осциллятор для панфлейты
            if (oscillators.length > 0) {
                oscillators[0].osc.frequency.setTargetAtTime(frequency * 2.01, audioContext.currentTime, 0.01);
            }
        }

        // Обновляем фильтр шума для воздушной флейты
        if (currentInstrument === 'flute3' && noiseNode) {
            // Фильтр уже создан, можно обновить его частоту через поиск в графе
        }
    }

    // Устанавливаем громкость
    if (gainNode) {
        gainNode.gain.setTargetAtTime(volume, audioContext.currentTime, 0.05);
    }
}

// Остановка звука
function stopSound() {
    if (isAudioPlaying) {
        if (useToneJS && toneSynth) {
            // Останавливаем Tone.js
            if (currentInstrument === 'organ') {
                toneSynth.stop();
            } else if (toneSynth._isPlaying) {
                toneSynth.triggerRelease();
                toneSynth._isPlaying = false;
            }
        } else {
            // Останавливаем Web Audio API с плавным затуханием
            const fadeOutTime = 0.05; // 50ms для плавного затухания
            const now = audioContext.currentTime;

            // Плавно уменьшаем громкость до почти нуля
            if (gainNode) {
                gainNode.gain.setValueAtTime(gainNode.gain.value, now);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + fadeOutTime);
            }

            // Останавливаем осцилляторы СРАЗУ, но с запланированным временем остановки
            if (oscillator) {
                try {
                    oscillator.stop(now + fadeOutTime);
                } catch (e) {
                    // Осциллятор уже остановлен
                }
                oscillator = null;
            }

            if (vibratoOsc) {
                try {
                    vibratoOsc.stop(now + fadeOutTime);
                } catch (e) {
                    // Осциллятор уже остановлен
                }
                vibratoOsc = null;
                vibratoGain = null;
            }

            if (noiseNode) {
                try {
                    noiseNode.stop(now + fadeOutTime);
                } catch (e) {
                    // Узел уже остановлен
                }
                noiseNode = null;
            }

            oscillators.forEach(item => {
                try {
                    item.osc.stop(now + fadeOutTime);
                } catch (e) {
                    // Осциллятор уже остановлен
                }
            });
            oscillators = [];
        }

        isAudioPlaying = false;
    }
}

// Установка размеров canvas на весь экран
function resizeCanvas() {
    drawingCanvas.width = window.innerWidth;
    drawingCanvas.height = window.innerHeight;
    handCanvas.width = window.innerWidth;
    handCanvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Создание клавиш пианино
function createPianoKeys() {
    const pianoKeys = document.querySelector('.piano-keys');
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

    // Создаем 3 октавы (36 клавиш)
    for (let octave = 2; octave <= 4; octave++) {
        whiteNotes.forEach(note => {
            const key = document.createElement('div');
            key.className = 'piano-key';
            key.dataset.note = `${note}${octave}`;
            key.dataset.frequency = getNoteFrequency(note, octave);
            key.textContent = `${note}${octave}`;
            pianoKeys.appendChild(key);
        });
    }

    // Добавляем черные клавиши
    const blackNotes = ['C#', 'D#', 'F#', 'G#', 'A#'];
    for (let octave = 2; octave <= 4; octave++) {
        blackNotes.forEach(note => {
            const key = document.createElement('div');
            key.className = 'piano-key black';
            key.dataset.note = `${note}${octave}`;
            key.dataset.frequency = getNoteFrequency(note, octave);
            key.textContent = `${note}${octave}`;
            pianoKeys.appendChild(key);
        });
    }
}

// Получение частоты ноты
function getNoteFrequency(note, octave) {
    const A4 = 440;
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyNumber = notes.indexOf(note) + (octave - 4) * 12 - 9; // Относительно A4
    return A4 * Math.pow(2, keyNumber / 12);
}

// Подсветка активной клавиши
function highlightPianoKey(frequency, isScalePlaying = false) {
    const keys = document.querySelectorAll('.piano-key');
    let closestKey = null;
    let minDiff = Infinity;

    keys.forEach(key => {
        key.classList.remove('active');
        key.classList.remove('scale-playing');
        const keyFreq = parseFloat(key.dataset.frequency);
        const diff = Math.abs(frequency - keyFreq);

        if (diff < minDiff) {
            minDiff = diff;
            closestKey = key;
        }
    });

    // Подсвечиваем ближайшую клавишу (если частота близка)
    if (closestKey && minDiff < 20) { // Порог 20 Hz
        if (isScalePlaying) {
            closestKey.classList.add('scale-playing');
        } else {
            closestKey.classList.add('active');
        }
    }
}

createPianoKeys();

// Переменная для отслеживания воспроизведения гаммы
let isPlayingScale = false;

// Функция воспроизведения одной ноты (для гаммы)
async function playNote(frequency, duration) {
    // Определяем, использовать ли Tone.js
    const toneJSInstruments = ['epiano', 'eguitar', 'bass', 'trumpet', 'saxophone', 'organ', 'vibraphone', 'marimba', 'bells'];
    const useToneJS = toneJSInstruments.includes(currentInstrument);

    if (useToneJS) {
        // Используем Tone.js - создаем новый синтезатор для каждой ноты
        try {
            const note = Tone.Frequency(frequency, "hz").toNote();
            let noteSynth;

            // Создаем синтезатор в зависимости от инструмента
            switch(currentInstrument) {
                case 'epiano':
                    noteSynth = new Tone.FMSynth({
                        harmonicity: 3,
                        modulationIndex: 10,
                        oscillator: { type: 'sine' },
                        envelope: { attack: 0.01, decay: 0.5, sustain: 0.3, release: 1 },
                        modulation: { type: 'square' },
                        modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.5 }
                    }).toDestination();
                    break;
                case 'eguitar':
                    noteSynth = new Tone.PluckSynth({
                        attackNoise: 1,
                        dampening: 3000,
                        resonance: 0.92
                    }).toDestination();
                    break;
                case 'bass':
                    noteSynth = new Tone.MonoSynth({
                        oscillator: { type: 'sawtooth' },
                        envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.5 },
                        filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.3, baseFrequency: 200, octaves: 2.5 }
                    }).toDestination();
                    break;
                case 'trumpet':
                    noteSynth = new Tone.FMSynth({
                        harmonicity: 1.5,
                        modulationIndex: 15,
                        oscillator: { type: 'sawtooth' },
                        envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.3 },
                        modulation: { type: 'square' },
                        modulationEnvelope: { attack: 0.05, decay: 0.1, sustain: 0.4, release: 0.2 }
                    }).toDestination();
                    break;
                case 'saxophone':
                    noteSynth = new Tone.FMSynth({
                        harmonicity: 2,
                        modulationIndex: 20,
                        oscillator: { type: 'sawtooth' },
                        envelope: { attack: 0.08, decay: 0.3, sustain: 0.7, release: 0.4 },
                        modulation: { type: 'sine' },
                        modulationEnvelope: { attack: 0.08, decay: 0.2, sustain: 0.5, release: 0.3 }
                    }).toDestination();
                    break;
                case 'organ':
                    noteSynth = new Tone.Synth({
                        oscillator: { type: 'sine' },
                        envelope: { attack: 0.001, decay: 0, sustain: 1, release: 0.1 }
                    }).toDestination();
                    break;
                case 'vibraphone':
                    noteSynth = new Tone.MetalSynth({
                        frequency: 200,
                        envelope: { attack: 0.001, decay: 1.4, release: 0.2 },
                        harmonicity: 5.1,
                        modulationIndex: 32,
                        resonance: 4000,
                        octaves: 1.5
                    }).toDestination();
                    break;
                case 'marimba':
                    noteSynth = new Tone.MetalSynth({
                        frequency: 200,
                        envelope: { attack: 0.001, decay: 1, release: 0.5 },
                        harmonicity: 8,
                        modulationIndex: 20,
                        resonance: 3000,
                        octaves: 1
                    }).toDestination();
                    break;
                case 'bells':
                    noteSynth = new Tone.MetalSynth({
                        frequency: 200,
                        envelope: { attack: 0.001, decay: 2, release: 1.5 },
                        harmonicity: 12,
                        modulationIndex: 40,
                        resonance: 5000,
                        octaves: 2
                    }).toDestination();
                    break;
                default:
                    noteSynth = new Tone.Synth({
                        oscillator: { type: 'sine' },
                        envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 }
                    }).toDestination();
            }

            noteSynth.triggerAttackRelease(note, duration / 1000);

            // Удаляем синтезатор после использования
            setTimeout(() => {
                noteSynth.dispose();
            }, duration + 100);
        } catch (e) {
            console.error('Tone.js error:', e);
        }
    } else {
        // Используем Web Audio API
        try {
            if (!audioContext) {
                console.error('Audio context not initialized');
                return;
            }

            const osc = audioContext.createOscillator();
            const noteGain = audioContext.createGain();

            // Специальная обработка для терменвокса
            if (currentInstrument === 'theremin') {
                osc.type = 'sine';
                osc.frequency.value = frequency;

                // Вибрато для терменвокса
                const vibrato = audioContext.createOscillator();
                const vibratoGainNode = audioContext.createGain();
                vibrato.type = 'sine';
                vibrato.frequency.value = 5.5;
                vibratoGainNode.gain.value = 15;

                vibrato.connect(vibratoGainNode);
                vibratoGainNode.connect(osc.frequency);

                // Envelope для терменвокса с плавным затуханием
                const releaseTime = 0.05; // 50ms для плавного затухания
                noteGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
                noteGain.gain.exponentialRampToValueAtTime(0.3, audioContext.currentTime + 0.02);
                noteGain.gain.exponentialRampToValueAtTime(0.28, audioContext.currentTime + duration / 1000 - releaseTime);
                noteGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration / 1000);

                osc.connect(noteGain);
                noteGain.connect(audioContext.destination);

                vibrato.start(audioContext.currentTime);
                vibrato.stop(audioContext.currentTime + duration / 1000 + releaseTime);
                osc.start(audioContext.currentTime);
                osc.stop(audioContext.currentTime + duration / 1000 + releaseTime);
            } else {
                // Обработка инструментов Web Audio API
                let additionalNodes = [];

                switch(currentInstrument) {
                    case 'flute1':
                        // Флейта классическая - чистый синус
                        osc.type = 'sine';
                        osc.frequency.value = frequency;
                        break;

                    case 'flute2':
                        // Флейта с вибрато
                        osc.type = 'sine';
                        osc.frequency.value = frequency;

                        const vibrato2 = audioContext.createOscillator();
                        const vibratoGain2 = audioContext.createGain();
                        vibrato2.type = 'sine';
                        vibrato2.frequency.value = 5;
                        vibratoGain2.gain.value = 10;
                        vibrato2.connect(vibratoGain2);
                        vibratoGain2.connect(osc.frequency);
                        vibrato2.start(audioContext.currentTime);
                        // Останавливаем vibrato после release time
                        additionalNodes.push({ node: vibrato2, stopTime: audioContext.currentTime + duration / 1000 + 0.05 });
                        break;

                    case 'flute3':
                        // Флейта воздушная
                        osc.type = 'sine';
                        osc.frequency.value = frequency;
                        break;

                    case 'piano':
                        // Пианино - используем только основную гармонику для короткой ноты
                        osc.type = 'sine';
                        osc.frequency.value = frequency;
                        break;

                    case 'violin':
                        // Скрипка - sawtooth
                        osc.type = 'sawtooth';
                        osc.frequency.value = frequency;
                        break;

                    case 'cello':
                        // Виолончель - sawtooth
                        osc.type = 'sawtooth';
                        osc.frequency.value = frequency;
                        break;

                    case 'guitar':
                    case 'ukulele':
                    case 'harp':
                        // Струнные - triangle
                        osc.type = 'triangle';
                        osc.frequency.value = frequency;
                        break;

                    case 'clarinet':
                        // Кларнет - square
                        osc.type = 'square';
                        osc.frequency.value = frequency;
                        break;

                    case 'panflute':
                    case 'recorder':
                        // Флейта Пана и блокфлейта - мягкий sine
                        osc.type = 'sine';
                        osc.frequency.value = frequency;
                        break;

                    case 'xylophone':
                    case 'glockenspiel':
                        // Ксилофон и глокеншпиль - яркий triangle
                        osc.type = 'triangle';
                        osc.frequency.value = frequency;
                        break;

                    default:
                        osc.type = 'sine';
                        osc.frequency.value = frequency;
                }

                // Envelope для более естественного звука с плавным затуханием
                const releaseTime = 0.05; // 50ms для плавного затухания
                noteGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
                noteGain.gain.exponentialRampToValueAtTime(0.3, audioContext.currentTime + 0.01); // Attack
                noteGain.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + duration / 1000 - releaseTime); // Sustain
                noteGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration / 1000); // Release

                osc.connect(noteGain);
                noteGain.connect(audioContext.destination);

                osc.start(audioContext.currentTime);
                osc.stop(audioContext.currentTime + duration / 1000 + releaseTime);

                // Останавливаем дополнительные ноды (например, vibrato)
                additionalNodes.forEach(item => {
                    item.node.stop(item.stopTime);
                });
            }
        } catch (e) {
            console.error('Web Audio error:', e);
        }
    }
}

// Базовый темп для мелодий (BPM - beats per minute)
const DEFAULT_TEMPO = 120; // 120 ударов в минуту

// Функция конвертации музыкальной длительности в миллисекунды
function noteDurationToMs(duration, tempo = DEFAULT_TEMPO) {
    const beatDuration = 60000 / tempo; // Длительность одной четверти в мс

    const durations = {
        'w': beatDuration * 4,      // whole - целая нота
        'h': beatDuration * 2,      // half - половинная
        'h.': beatDuration * 3,     // dotted half - пунктирная половинная
        'q': beatDuration,          // quarter - четверть
        'q.': beatDuration * 1.5,   // dotted quarter - пунктирная четверть
        'e': beatDuration / 2,      // eighth - восьмая
        'e.': beatDuration * 0.75,  // dotted eighth - пунктирная восьмая
        's': beatDuration / 4,      // sixteenth - шестнадцатая
        's.': beatDuration * 0.375, // dotted sixteenth - пунктирная шестнадцатая
    };

    return durations[duration] || beatDuration;
}

// Библиотека мелодий
const melodies = {
    scale: {
        name: 'Гамма',
        tempo: 120,
        notes: [
            { note: 'C', octave: 3, duration: 'q' },
            { note: 'D', octave: 3, duration: 'q' },
            { note: 'E', octave: 3, duration: 'q' },
            { note: 'F', octave: 3, duration: 'q' },
            { note: 'G', octave: 3, duration: 'q' },
            { note: 'A', octave: 3, duration: 'q' },
            { note: 'B', octave: 3, duration: 'q' },
            { note: 'C', octave: 4, duration: 'q' },
            { note: 'B', octave: 3, duration: 'q' },
            { note: 'A', octave: 3, duration: 'q' },
            { note: 'G', octave: 3, duration: 'q' },
            { note: 'F', octave: 3, duration: 'q' },
            { note: 'E', octave: 3, duration: 'q' },
            { note: 'D', octave: 3, duration: 'q' },
            { note: 'C', octave: 3, duration: 'q' },
        ]
    },
    melody1: {
        name: 'Мелодия 1',
        tempo: 120,
        notes: [
            { note: 'E', octave: 4, duration: 'q' },
            { note: 'G', octave: 4, duration: 'e' },
            { note: 'F', octave: 4, duration: 'e' },
            { note: 'E', octave: 4, duration: 'q' },
            { note: 'D', octave: 4, duration: 'q' },
            { note: 'C', octave: 4, duration: 'q' },
            { note: 'D', octave: 4, duration: 'q' },
            { note: 'E', octave: 4, duration: 'q' },
            { note: 'E', octave: 4, duration: 'e.' },
            { note: 'D', octave: 4, duration: 's' },
            { note: 'D', octave: 4, duration: 'h' },
            { note: 'E', octave: 4, duration: 'q' },
            { note: 'G', octave: 4, duration: 'e' },
            { note: 'F', octave: 4, duration: 'e' },
            { note: 'E', octave: 4, duration: 'q' },
            { note: 'D', octave: 4, duration: 'q' },
            { note: 'C', octave: 4, duration: 'q' },
            { note: 'D', octave: 4, duration: 'q' },
            { note: 'E', octave: 4, duration: 'q' },
            { note: 'D', octave: 4, duration: 'e.' },
            { note: 'C', octave: 4, duration: 's' },
            { note: 'C', octave: 4, duration: 'h' },
        ]
    },
    melody2: {
        name: 'Мелодия 2',
        tempo: 140,
        notes: [
            { note: 'E', octave: 4, duration: 'e' },
            { note: 'A', octave: 4, duration: 'e' },
            { note: 'C', octave: 5, duration: 'e' },
            { note: 'B', octave: 4, duration: 'e' },
            { note: 'A', octave: 4, duration: 'e' },
            { note: 'E', octave: 4, duration: 'e' },
            { note: 'D', octave: 4, duration: 'e' },
            { note: 'B', octave: 4, duration: 'e' },
            { note: 'A', octave: 4, duration: 'e' },
            { note: 'C', octave: 5, duration: 'e' },
            { note: 'B', octave: 4, duration: 'e' },
            { note: 'G', octave: 4, duration: 'e' },
            { note: 'B', octave: 4, duration: 'e' },
            { note: 'E', octave: 4, duration: 'e' },
            { note: 'A', octave: 4, duration: 'e' },
            { note: 'C', octave: 5, duration: 'e' },
            { note: 'B', octave: 4, duration: 'e' },
            { note: 'G', octave: 4, duration: 'e' },
            { note: 'B', octave: 4, duration: 'e' },
            { note: 'E', octave: 4, duration: 'e' },
            { note: 'A', octave: 4, duration: 'e' },
            { note: 'C', octave: 5, duration: 'e' },
            { note: 'B', octave: 4, duration: 'e' },
            { note: 'G', octave: 4, duration: 'e' },
            { note: 'B', octave: 4, duration: 'e' },
            { note: 'A', octave: 4, duration: 'e' },
            { note: 'E', octave: 4, duration: 'q' },
        ]
    },
    melody3: {
        name: 'Мелодия 3',
        tempo: 100,
        notes: [
            // Фраза 1
            { note: 'A', octave: 3, duration: 'q.' },
            { note: 'E', octave: 4, duration: 'e' },
            { note: 'F', octave: 4, duration: 'e' },
            { note: 'E', octave: 4, duration: 'e' },
            { note: 'A', octave: 3, duration: 'q' },
            { note: 'C', octave: 4, duration: 'e.' },
            { note: 'D', octave: 4, duration: 'e.' },
            { note: 'C', octave: 4, duration: 'e.' },
            { note: 'A', octave: 3, duration: 'e' },
            { note: 'D', octave: 4, duration: 'q' },
            // Фраза 2
            { note: 'A', octave: 3, duration: 'q.' },
            { note: 'E', octave: 4, duration: 'e' },
            { note: 'F', octave: 4, duration: 'e' },
            { note: 'E', octave: 4, duration: 'e' },
            { note: 'A', octave: 3, duration: 'q' },
            { note: 'C', octave: 4, duration: 'e.' },
            { note: 'D', octave: 4, duration: 'e.' },
            { note: 'C', octave: 4, duration: 'e.' },
            { note: 'A', octave: 3, duration: 'e' },
            { note: 'D', octave: 4, duration: 'q' },
        ]
    }
};

// Универсальная функция воспроизведения
async function playSelected() {
    if (isPlayingScale) return;

    // Инициализируем аудио если нужно
    if (!audioContext) {
        initAudio();
        await Tone.start();
        isAudioEnabled = true;
        audioBtn.textContent = '🔇 Выключить звук';
    }

    const selectedMelody = melodySelect.value;
    const melody = melodies[selectedMelody];

    if (!melody) return;

    isPlayingScale = true;
    playSelectedBtn.disabled = true;
    playSelectedBtn.textContent = '⏸️ Играю...';

    const tempo = melody.tempo || DEFAULT_TEMPO;
    const pauseBetweenNotes = 50;

    // Проигрываем мелодию
    for (let i = 0; i < melody.notes.length; i++) {
        const noteData = melody.notes[i];
        const freq = getNoteFrequency(noteData.note, noteData.octave);

        // Конвертируем длительность из музыкального обозначения в миллисекунды
        const durationMs = typeof noteData.duration === 'string'
            ? noteDurationToMs(noteData.duration, tempo)
            : noteData.duration; // Если уже в миллисекундах

        highlightPianoKey(freq, true);
        playNote(freq, durationMs);
        await new Promise(resolve => setTimeout(resolve, durationMs + pauseBetweenNotes));
    }

    // Убираем подсветку
    const keys = document.querySelectorAll('.piano-key');
    keys.forEach(key => key.classList.remove('scale-playing'));

    isPlayingScale = false;
    playSelectedBtn.disabled = false;
    playSelectedBtn.textContent = '▶️ Играть';
}

// Обработчик кнопки воспроизведения
playSelectedBtn.addEventListener('click', playSelected);

// Обновление настроек
colorPicker.addEventListener('change', (e) => {
    drawingColor = e.target.value;
});

clearBtn.addEventListener('click', () => {
    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    lastPoint = null;
});

audioBtn.addEventListener('click', async () => {
    if (!isAudioEnabled) {
        // Включаем звук
        initAudio();
        // Запуск Tone.js (требует взаимодействия пользователя)
        await Tone.start();
        isAudioEnabled = true;
        audioBtn.textContent = '🔇 Выключить звук';
    } else {
        // Выключаем звук
        stopSound();
        isAudioEnabled = false;
        audioBtn.textContent = '🔊 Включить звук';
    }
});

instrumentSelect.addEventListener('change', (e) => {
    currentInstrument = e.target.value;
    // Останавливаем текущий звук при смене инструмента
    if (isAudioPlaying) {
        stopSound();
    }
});

octaveUpBtn.addEventListener('click', () => {
    if (octaveShift < 2) {
        octaveShift++;
        octaveValueElement.textContent = octaveShift > 0 ? `+${octaveShift}` : octaveShift;
    }
});

octaveDownBtn.addEventListener('click', () => {
    if (octaveShift > -2) {
        octaveShift--;
        octaveValueElement.textContent = octaveShift > 0 ? `+${octaveShift}` : octaveShift;
    }
});

// Функция для вычисления расстояния между двумя точками
function distance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Проверка попадания точки в круглую кнопку
function isPointInButton(x, y, buttonElement) {
    const rect = buttonElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;

    const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    return dist <= radius;
}

// Изменение октавы с cooldown
function changeOctave(delta) {
    const now = Date.now();
    if (now - lastOctaveChangeTime < OCTAVE_CHANGE_COOLDOWN) {
        return false;
    }

    const newOctave = octaveShift + delta;
    if (newOctave >= -2 && newOctave <= 2) {
        octaveShift = newOctave;
        octaveValueElement.textContent = octaveShift > 0 ? `+${octaveShift}` : octaveShift;
        lastOctaveChangeTime = now;
        return true;
    }
    return false;
}

// Функция для рисования линии на drawingCanvas (НЕ стирается!)
function drawLine(from, to) {
    drawingCtx.beginPath();
    drawingCtx.moveTo(from.x, from.y);
    drawingCtx.lineTo(to.x, to.y);
    drawingCtx.strokeStyle = drawingColor;
    drawingCtx.lineWidth = lineWidth;
    drawingCtx.lineCap = 'round';
    drawingCtx.lineJoin = 'round';
    drawingCtx.stroke();
}

// Обработка результатов от MediaPipe Hands
function onResults(results) {
    // Очищаем ТОЛЬКО canvas для отрисовки руки (НЕ трогаем drawingCanvas!)
    handCtx.save();
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

    // Применяем зеркальное отражение для согласования с инвертированными координатами пальцев
    handCtx.translate(handCanvas.width, 0);
    handCtx.scale(-1, 1);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Индексы пальцев в MediaPipe Hands:
        // 0 - запястье
        // 4 - кончик большого пальца
        // 8 - кончик указательного пальца
        // 12 - кончик среднего пальца
        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        
        // Преобразуем координаты в координаты canvas
        // Canvas уже зеркально отражен через transform, поэтому используем прямые координаты
        const thumbX = thumbTip.x * handCanvas.width;
        const thumbY = thumbTip.y * handCanvas.height;
        const indexX = indexTip.x * handCanvas.width;
        const indexY = indexTip.y * handCanvas.height;

        // Вычисляем расстояние между большим и указательным пальцами
        const dist = distance(
            { x: thumbX, y: thumbY },
            { x: indexX, y: indexY }
        );

        // Вычисляем размер руки (от запястья до среднего пальца) - показывает расстояние до камеры
        const wristX = wrist.x * handCanvas.width;
        const wristY = wrist.y * handCanvas.height;
        const middleX = middleTip.x * handCanvas.width;
        const middleY = middleTip.y * handCanvas.height;
        const handSize = distance(
            { x: wristX, y: wristY },
            { x: middleX, y: middleY }
        );

        // Порог для определения "сжатия" пальцев (50 пикселей - увеличен для fullscreen)
        const threshold = 50;

        // Обновляем debug info
        if (indexCoordsElement) indexCoordsElement.textContent = `(${Math.round(indexX)}, ${Math.round(indexY)})`;
        if (thumbCoordsElement) thumbCoordsElement.textContent = `(${Math.round(thumbX)}, ${Math.round(thumbY)})`;
        if (distanceElement) distanceElement.textContent = `${Math.round(dist)} px`;
        if (depthElement) depthElement.textContent = `${Math.round(handSize)} px (↑ ближе к камере)`;
        if (pinchStatusElement) {
            pinchStatusElement.textContent = dist < threshold ? '✅ Сомкнуты' : '❌ Разведены';
            pinchStatusElement.style.color = dist < threshold ? '#4ade80' : '#f87171';
        }

        // Рисуем точку указательного пальца
        handCtx.fillStyle = isDrawing ? 'lime' : 'red';
        handCtx.beginPath();
        handCtx.arc(indexX, indexY, 12, 0, 2 * Math.PI);
        handCtx.fill();

        // Рисуем точку большого пальца
        handCtx.fillStyle = 'blue';
        handCtx.beginPath();
        handCtx.arc(thumbX, thumbY, 12, 0, 2 * Math.PI);
        handCtx.fill();

        // Линия между пальцами
        handCtx.strokeStyle = dist < threshold ? 'lime' : 'red';
        handCtx.lineWidth = 3;
        handCtx.beginPath();
        handCtx.moveTo(thumbX, thumbY);
        handCtx.lineTo(indexX, indexY);
        handCtx.stroke();
        
        // Вычисляем экранные координаты для проверки кнопок
        const screenX = handCanvas.width - indexX; // Инвертированный X для экрана
        const screenY = indexY;

        // Получаем элементы кнопок
        const octaveDownBtn = document.getElementById('octaveDownGesture');
        const octaveUpBtn = document.getElementById('octaveUpGesture');

        // Проверяем попадание в кнопки
        const inOctaveDown = isPointInButton(screenX, screenY, octaveDownBtn);
        const inOctaveUp = isPointInButton(screenX, screenY, octaveUpBtn);

        // Подсвечиваем кнопки при наведении
        octaveDownBtn.classList.toggle('active', inOctaveDown && dist < threshold);
        octaveUpBtn.classList.toggle('active', inOctaveUp && dist < threshold);

        // Вычисляем частоту звука в зависимости от X (для подсветки клавиш)
        // Используем инвертированный X для согласования с движением: влево=низко, вправо=высоко
        const normalizedX = (handCanvas.width - indexX) / handCanvas.width; // 0..1
        const baseFrequency = 110; // Нота A2
        let currentFrequency = baseFrequency * Math.pow(2, normalizedX * 3); // 3 октавы
        // Применяем смещение октавы
        currentFrequency = currentFrequency * Math.pow(2, octaveShift);

        // Подсвечиваем клавишу пианино всегда, когда видна рука
        highlightPianoKey(currentFrequency);

        // Проверяем сжатие пальцев
        if (dist < threshold) {
            // Если палец в области кнопки октавы - меняем октаву вместо рисования
            if (inOctaveDown) {
                if (changeOctave(-1)) {
                    statusElement.textContent = '🔽 Октава вниз';
                    statusElement.className = 'active';
                }
                lastPoint = null;
                isDrawing = false;
            } else if (inOctaveUp) {
                if (changeOctave(1)) {
                    statusElement.textContent = '🔼 Октава вверх';
                    statusElement.className = 'active';
                }
                lastPoint = null;
                isDrawing = false;
            } else {
                // Пальцы сомкнуты - рисуем и воспроизводим звук
                // Для рисования на drawingCanvas нужно инвертировать X, так как там нет transform
                const currentPoint = {
                    x: screenX,
                    y: screenY
                };

                if (isDrawing && lastPoint) {
                    drawLine(lastPoint, currentPoint);
                }

                lastPoint = currentPoint;
                isDrawing = true;
                statusElement.textContent = '✍️ Рисую...';
                statusElement.className = 'drawing';

                // Вычисляем громкость в зависимости от координаты Y
                // Верх экрана (Y=0): громко, Низ экрана (Y=height): тихо
                const normalizedY = 1 - (indexY / handCanvas.height); // Инвертируем: 1 вверху, 0 внизу
                const volume = 0.05 + normalizedY * 0.45; // Громкость от 0.05 до 0.5

                startSound(currentFrequency, volume);

                // Обновляем частоту в debug info
                if (frequencyElement) {
                    frequencyElement.textContent = `${Math.round(currentFrequency)} Hz (${Math.round(volume * 100)}%)`;
                }
            }
        } else {
            // Пальцы разведены - не рисуем, останавливаем звук
            isDrawing = false;
            lastPoint = null;
            statusElement.textContent = '🖐️ Готов к рисованию';
            statusElement.className = 'active';
            stopSound();

            // Убираем подсветку только с кнопок октав (клавиши пианино остаются подсвеченными)
            document.querySelectorAll('.gesture-button').forEach(btn => btn.classList.remove('active'));

            // Показываем текущую частоту даже без звука
            if (frequencyElement) {
                frequencyElement.textContent = `${Math.round(currentFrequency)} Hz (без звука)`;
            }
        }
        
        // Отрисовка скелета руки (опционально, для отладки)
        // Используем оригинальные landmarks (они уже согласованы с инвертированными координатами пальцев)
        drawConnectors(handCtx, landmarks, HAND_CONNECTIONS, {
            color: 'rgba(0, 255, 0, 0.5)',
            lineWidth: 3
        });
        drawLandmarks(handCtx, landmarks, {
            color: 'rgba(255, 255, 255, 0.6)',
            lineWidth: 2,
            radius: 5
        });
    } else {
        statusElement.textContent = '🤚 Покажите руку камере';
        statusElement.className = '';
        isDrawing = false;
        lastPoint = null;
        stopSound(); // Останавливаем звук когда рука исчезает

        // Убираем подсветку с клавиш и кнопок
        document.querySelectorAll('.piano-key').forEach(key => key.classList.remove('active'));
        document.querySelectorAll('.gesture-button').forEach(btn => btn.classList.remove('active'));

        // Очищаем debug info
        if (indexCoordsElement) indexCoordsElement.textContent = '-';
        if (thumbCoordsElement) thumbCoordsElement.textContent = '-';
        if (distanceElement) distanceElement.textContent = '-';
        if (depthElement) depthElement.textContent = '-';
        if (pinchStatusElement) {
            pinchStatusElement.textContent = '-';
            pinchStatusElement.style.color = '#4ade80';
        }
        if (frequencyElement) frequencyElement.textContent = '-';
    }

    handCtx.restore();
}

// Инициализация MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

// Определение мобильного устройства
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Оптимизация настроек для мобильных устройств
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: isMobile ? 0 : 1, // Легкая модель для мобильных
    minDetectionConfidence: isMobile ? 0.6 : 0.5,
    minTrackingConfidence: isMobile ? 0.6 : 0.5
});

hands.onResults(onResults);

// Функция для показа ошибок на экране
function showError(message, error = null) {
    statusElement.textContent = message;
    statusElement.style.background = 'rgba(220, 38, 38, 0.8)';
    statusElement.style.fontSize = '11px';
    statusElement.style.padding = '10px 15px';
    statusElement.style.maxWidth = '90%';
    statusElement.style.wordWrap = 'break-word';
    if (error) {
        console.error(message, error);
        // Добавляем детали ошибки в debug info
        if (pinchStatusElement) {
            pinchStatusElement.textContent = error.toString();
            pinchStatusElement.style.color = '#ef4444';
        }
    }
}

// Проверка поддержки getUserMedia
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError('❌ Камера недоступна. Требуется HTTPS соединение для доступа к камере!');
} else {
    // Разрешение камеры (меньше для мобильных)
    const cameraWidth = isMobile ? 480 : 640;
    const cameraHeight = isMobile ? 360 : 480;

    statusElement.textContent = isMobile ? '📱 Загрузка (мобильный режим)...' : '💻 Загрузка...';

    // Инициализация камеры
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            try {
                await hands.send({ image: videoElement });
            } catch (error) {
                showError('❌ Ошибка обработки кадра: ' + error.message, error);
            }
        },
        width: cameraWidth,
        height: cameraHeight,
        facingMode: isMobile ? 'environment' : 'user' // Задняя камера на мобильных
    });

    // Запуск камеры
    camera.start().then(() => {
        statusElement.textContent = isMobile ? '📱 Камера активна. Покажите руку!' : '📹 Камера активна. Покажите руку!';
        statusElement.className = 'active';
        console.log('Camera started successfully. Resolution:', cameraWidth, 'x', cameraHeight);
    }).catch((error) => {
        let errorMsg = '❌ Ошибка доступа к камере: ' + error.message;

        // Специальное сообщение для проблем с безопасностью
        if (error.name === 'NotAllowedError') {
            errorMsg = '❌ Доступ к камере запрещён. Разрешите доступ в настройках браузера.';
        } else if (error.name === 'NotFoundError') {
            errorMsg = '❌ Камера не найдена. Подключите камеру и обновите страницу.';
        } else if (error.name === 'OverconstrainedError') {
            errorMsg = '❌ Камера не поддерживает требуемые параметры. Попробуйте другую камеру.';
        } else if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
            errorMsg = '❌ Требуется HTTPS! Камера не работает через HTTP. Используйте https://' + window.location.hostname;
        }

        showError(errorMsg, error);
    });
}
