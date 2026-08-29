<script lang="ts">
    let isProcessing = $state(false);
    let currentNote = $state("-");
    let feedback = $state("Press start to sing");
    let debugLog = $state("Awaiting start...");
    
    const solfege = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
    const targetNotes = [
        { name: "Do", midi: 60 }, { name: "Re", midi: 62 }, { name: "Mi", midi: 64 },
        { name: "Fa", midi: 65 }, { name: "Sol", midi: 67 }, { name: "La", midi: 69 }, { name: "Si", midi: 71 }
    ];
    
    let level = $state(0);
    let targetNoteStr = $derived(targetNotes[level]?.name || "Win!");
    let targetMidiNote = $derived(targetNotes[level]?.midi || 0);
    
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
        try {
            debugLog = "1. Loading WASM...";
            // Dynamically import the Rust WASM module into the main thread
            // @ts-expect-error - The file exists at runtime, tell TS to skip checking the path
            const wasm = await import('/tuner/wasm/wasm_processor.js');
            const init = wasm.default;
            const PitchDetector = wasm.PitchDetector;

            await init('/tuner/wasm/wasm_processor_bg.wasm');

            debugLog = "2. Creating AudioContext...";
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const audioCtx = new AudioContextClass();

            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            const detector = PitchDetector.new(audioCtx.sampleRate);

            debugLog = "3. Requesting Mic...";
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioCtx.createMediaStreamSource(stream);
            
            // Create Analyser instead of Worklet
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 4096; // 4096 gives high resolution for pitch detection
            
            // Connect mic to analyser (DO NOT connect analyser to destination/speakers)
            source.connect(analyser);

            debugLog = "4. Ready! Processing audio...";
            isProcessing = true;
            feedback = `Sing '${targetNoteStr}'!`;

            const buffer = new Float32Array(analyser.fftSize);

            function detectPitchLoop() {
                if (!isProcessing) return;
                
                // Pull the raw audio wave directly into our buffer
                analyser.getFloatTimeDomainData(buffer);
                
                // Send it to Rust
                const pitch = detector.detect_pitch(buffer);
                
                if (pitch > 0) {
                    debugLog = `Raw Pitch: ${pitch.toFixed(1)} Hz`;
                    
                    if (level < targetNotes.length) {
                        const midiNote = hzToMidi(pitch);
                        currentNote = midiToSolfege(midiNote);

                        if (midiNote === targetMidiNote) {
                            if (successStart === 0) successStart = Date.now();
                            holdProgress = Math.min(100, ((Date.now() - successStart) / 1500) * 100);
                            feedback = "Perfect! Hold it!";
                            
                            if (holdProgress >= 100) {
                                level++;
                                successStart = 0;
                                holdProgress = 0;
                                feedback = level < targetNotes.length 
                                    ? `Great! Now sing '${targetNotes[level].name}'!` 
                                    : "You beat the game!";
                            }
                        } else {
                            successStart = 0;
                            holdProgress = 0;
                            feedback = midiNote > targetMidiNote ? "Lower! ↓" : "Higher! ↑";
                        }
                    }
                }
                
                // Run this loop natively at 60 FPS
                requestAnimationFrame(detectPitchLoop);
            }
            
            // Start the loop
            detectPitchLoop();
            
        } catch (err) {
            isProcessing = false;
            debugLog = err instanceof Error ? `ERR: ${err.message}` : "Unknown Error";
            console.error(err);
        }
    }
</script>

<div class="min-h-screen bg-linear-to-br from-sky-300 via-cyan-100 to-emerald-200 flex items-center justify-center p-4">
    <div class="relative bg-white/30 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,150,200,0.2)] rounded-3xl p-8 max-w-md w-full overflow-hidden text-center">
        
        <div class="relative z-10 flex flex-col items-center mb-6">
            <h1 class="text-4xl font-extrabold text-teal-900 drop-shadow-md tracking-tight">Level {level < targetNotes.length ? level + 1 : "Complete"}</h1>
            <p class="text-teal-700 font-medium text-lg mt-2 font-mono bg-white/40 px-4 py-1 rounded-full">{feedback}</p>
        </div>

        <div class="space-y-6 relative z-10 my-8">
            <div class="flex justify-between items-end px-4">
                <div class="flex flex-col items-center">
                    <span class="text-teal-800 text-sm font-bold uppercase tracking-widest">You</span>
                    <span class="text-6xl font-black text-cyan-600 drop-shadow-md">{currentNote}</span>
                </div>
                <div class="w-px h-16 bg-teal-800/20"></div>
                <div class="flex flex-col items-center">
                    <span class="text-teal-800 text-sm font-bold uppercase tracking-widest">Target</span>
                    <span class="text-5xl font-black text-teal-800/50 drop-shadow-sm">{targetNoteStr}</span>
                </div>
            </div>

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
                disabled={isProcessing}
                class="w-full relative overflow-hidden bg-linear-to-b from-cyan-400 to-blue-500 rounded-full py-4 px-6 text-white text-lg font-bold shadow-[inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-4px_8px_rgba(0,0,0,0.2),0_4px_10px_rgba(0,100,200,0.4)] hover:from-cyan-300 hover:to-blue-400 transition-all disabled:opacity-75"
            >
                {isProcessing ? "Listening..." : "Start Game"}
            </button>
        </div>
    </div>
</div>