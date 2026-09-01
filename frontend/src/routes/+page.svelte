<script lang="ts">
    let isProcessing = $state(false);
    let isGameOver = $state(false);
    let currentNote = $state("-");
    let feedback = $state("Press start to sing");
    let debugLog = $state("Awaiting start...");
    
    // Timer and Score States
    const MAX_TIME = 15.0;
    let timeLeft = $state(MAX_TIME);
    let score = $state(0);
    let lastFrameTime = 0;
    
    const solfege = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
    const targetNotes = [
        { name: "Do", midi: 60 }, { name: "Re", midi: 62 }, { name: "Mi", midi: 64 },
        { name: "Fa", midi: 65 }, { name: "Sol", midi: 67 }, { name: "La", midi: 69 }, { name: "Si", midi: 71 }
    ];
    
    // Loop indefinitely by using modulo
    let targetNoteStr = $derived(targetNotes[score % targetNotes.length].name);
    let targetMidiNote = $derived(targetNotes[score % targetNotes.length].midi);
    
    let holdProgress = $state(0);
    let successStart = 0;

    function hzToMidi(hz: number): number {
        return Math.round(12 * Math.log2(hz / 440)) + 69;
    }
    function midiToSolfege(midi: number): string {
        return solfege[midi % 12];
    }

    async function initializeAudio() {
        if (isProcessing) return;
        
        // Reset Game State
        isGameOver = false;
        score = 0;
        timeLeft = MAX_TIME;
        holdProgress = 0;
        successStart = 0;
        lastFrameTime = 0;

        try {
            debugLog = "1. Loading WASM...";
            const wasmUrl = '/tuner/wasm/wasm_processor.js';
            const wasm = (await import(/* @vite-ignore */ wasmUrl)) as unknown as {
                default: (url: string) => Promise<void>;
                PitchDetector: { new (sampleRate: number): { detect_pitch(buffer: Float32Array): number } };
            };
            
            const init = wasm.default;
            const PitchDetector = wasm.PitchDetector;
            await init('/tuner/wasm/wasm_processor_bg.wasm');

            debugLog = "2. Creating AudioContext...";
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') await audioCtx.resume();

            const detector = new PitchDetector(audioCtx.sampleRate);

            debugLog = "3. Requesting Mic...";
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 4096; 
            source.connect(analyser);

            debugLog = "4. Ready! Processing audio...";
            isProcessing = true;
            feedback = `Sing '${targetNoteStr}'!`;

            const buffer = new Float32Array(analyser.fftSize);

            function detectPitchLoop(timestamp: DOMHighResTimeStamp) {
                if (!isProcessing || isGameOver) return;
                
                // Time Attack Logic
                if (!lastFrameTime) lastFrameTime = timestamp;
                const dt = (timestamp - lastFrameTime) / 1000; // Convert ms to seconds
                lastFrameTime = timestamp;
                
                timeLeft -= dt;
                if (timeLeft <= 0) {
                    timeLeft = 0;
                    isGameOver = true;
                    isProcessing = false;
                    feedback = `Game Over! Final Score: ${score}`;
                    return;
                }
                
                analyser.getFloatTimeDomainData(buffer);
                const pitch = detector.detect_pitch(buffer);
                
                if (pitch > 0) {
                    debugLog = `Raw Pitch: ${pitch.toFixed(1)} Hz`;
                    const midiNote = hzToMidi(pitch);
                    currentNote = midiToSolfege(midiNote);

                    if (midiNote === targetMidiNote) {
                        if (successStart === 0) successStart = Date.now();
                        holdProgress = Math.min(100, ((Date.now() - successStart) / 1500) * 100);
                        feedback = "Perfect! Hold it!";
                        
                        if (holdProgress >= 100) {
                            score++;
                            // Reward: Add 3 seconds, but cap it at MAX_TIME
                            timeLeft = Math.min(MAX_TIME, timeLeft + 3.0);
                            successStart = 0;
                            holdProgress = 0;
                            feedback = `+3s! Next: '${targetNoteStr}'!`;
                        }
                    } else {
                        successStart = 0;
                        holdProgress = 0;
                        feedback = midiNote > targetMidiNote ? "Lower! ↓" : "Higher! ↑";
                    }
                }
                
                requestAnimationFrame(detectPitchLoop);
            }
            
            requestAnimationFrame(detectPitchLoop);
            
        } catch (err) {
            isProcessing = false;
            debugLog = err instanceof Error ? `ERR: ${err.message}` : "Unknown Error";
            console.error(err);
        }
    }
</script>

<div class="min-h-screen bg-linear-to-br from-sky-300 via-cyan-100 to-emerald-200 flex items-center justify-center p-4">
    <div class="relative bg-white/30 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,150,200,0.2)] rounded-3xl p-8 max-w-md w-full overflow-hidden text-center {isGameOver ? 'ring-4 ring-red-400' : ''}">
        
        <!-- Survival Timer Bar -->
        <div class="absolute top-0 left-0 w-full h-2 bg-black/10">
            <div class="h-full transition-all duration-100 linear {timeLeft < 5 ? 'bg-red-500' : 'bg-emerald-400'}" style="width: {(timeLeft / MAX_TIME) * 100}%"></div>
        </div>

        <div class="relative z-10 flex flex-col items-center mb-6 mt-2">
            <h1 class="text-4xl font-extrabold text-teal-900 drop-shadow-md tracking-tight">Score: {score}</h1>
            <div class="text-3xl font-black {timeLeft < 5 ? 'text-red-600 animate-pulse' : 'text-teal-700'} my-2">
                {timeLeft.toFixed(1)}s
            </div>
            <p class="text-teal-700 font-medium text-lg mt-1 font-mono bg-white/40 px-4 py-1 rounded-full">{feedback}</p>
        </div>

        <div class="space-y-6 relative z-10 my-8">
            <div class="flex justify-between items-end px-4">
                <div class="flex flex-col items-center">
                    <span class="text-teal-800 text-sm font-bold uppercase tracking-widest">You</span>
                    <span class="text-6xl font-black {isGameOver ? 'text-gray-400' : 'text-cyan-600'} drop-shadow-md">{currentNote}</span>
                </div>
                <div class="w-px h-16 bg-teal-800/20"></div>
                <div class="flex flex-col items-center">
                    <span class="text-teal-800 text-sm font-bold uppercase tracking-widest">Target</span>
                    <span class="text-5xl font-black text-teal-800/50 drop-shadow-sm">{targetNoteStr}</span>
                </div>
            </div>

            <!-- Hold Progress Bar -->
            <div class="h-4 w-full bg-teal-900/10 rounded-full mt-4 overflow-hidden border border-teal-900/20 shadow-inner">
                <div class="h-full bg-linear-to-r from-cyan-400 to-emerald-400 transition-all duration-100 ease-out" style="width: {holdProgress}%"></div>
            </div>
        </div>

        <div class="relative z-10 mt-6 flex flex-col gap-3">
            <div class="bg-black/10 rounded-lg p-2 text-xs font-mono text-teal-900 text-left overflow-hidden whitespace-nowrap text-ellipsis">
                Log: {debugLog}
            </div>

            <button 
                onclick={initializeAudio}
                class="w-full relative overflow-hidden bg-linear-to-b from-cyan-400 to-blue-500 rounded-full py-4 px-6 text-white text-lg font-bold shadow-[inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-4px_8px_rgba(0,0,0,0.2),0_4px_10px_rgba(0,100,200,0.4)] hover:from-cyan-300 hover:to-blue-400 transition-all {isProcessing && !isGameOver ? 'opacity-50 pointer-events-none' : ''}"
            >
                {isGameOver ? "Play Again" : (isProcessing ? "Listening..." : "Start Game")}
            </button>
        </div>
    </div>
</div>