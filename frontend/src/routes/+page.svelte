<script lang="ts">
    // Svelte 5 runes for state
    let isProcessing = $state(false);
    let currentNote = $state("-");
    let feedback = $state("Press start to sing");
    
    // Let's set a target note for gamification (e.g., Mi 4)
    const targetNoteStr = "Mi";
    const targetMidiNote = 64; // E4 (Mi)
    
    const solfege = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];

    function hzToMidi(hz: number): number {
        return Math.round(12 * Math.log2(hz / 440)) + 69;
    }

    function midiToSolfege(midi: number): string {
        return solfege[midi % 12];
    }

    async function initializeAudio() {
        if (isProcessing) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
            });

            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(stream);

            // Load the polyfill FIRST so TextDecoder is ready
            await audioCtx.audioWorklet.addModule('/tuner/polyfill.js');
            // Then load our processor
            await audioCtx.audioWorklet.addModule('/tuner/audio-processor.js');

            const wasmResponse = await fetch('/tuner/wasm/wasm_processor_bg.wasm');
            const wasmBuffer = await wasmResponse.arrayBuffer();
            const wasmModule = await WebAssembly.compile(wasmBuffer);

            const workletNode = new AudioWorkletNode(audioCtx, 'pitch-detector-processor');

            workletNode.port.onmessage = (event) => {
                if (event.data.type === 'ready') {
                    isProcessing = true;
                    feedback = "Sing a 'Mi'!";
                    source.connect(workletNode);
                    workletNode.connect(audioCtx.destination);
                } else if (event.data.type === 'pitch') {
                    const midiNote = hzToMidi(event.data.hz);
                    currentNote = midiToSolfege(midiNote);

                    // Game logic: Compare current pitch to target
                    if (midiNote === targetMidiNote) {
                        feedback = "Perfect! Hold it!";
                    } else if (midiNote > targetMidiNote) {
                        feedback = "Lower! ↓";
                    } else {
                        feedback = "Higher! ↑";
                    }
                }
            };

            workletNode.port.postMessage({ 
                type: 'init-wasm', 
                wasmModule,
                sampleRate: audioCtx.sampleRate 
            });

        } catch (err) {
            console.error(err);
            alert("Could not access microphone.");
        }
    }
</script>

<!-- Updated bg-linear-to-b per Tailwind v4 -->
<div class="min-h-screen bg-linear-to-br from-sky-300 via-cyan-100 to-emerald-200 flex items-center justify-center p-4">
    <div class="relative bg-white/30 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,150,200,0.2)] rounded-3xl p-8 max-w-md w-full overflow-hidden text-center">
        
        <div class="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-white/40 to-transparent pointer-events-none"></div>

        <div class="relative z-10 flex flex-col items-center mb-6">
            <h1 class="text-4xl font-extrabold text-teal-900 drop-shadow-md tracking-tight">Vocal Tuner</h1>
            <p class="text-teal-700 font-medium text-lg mt-2 font-mono bg-white/40 px-4 py-1 rounded-full">{feedback}</p>
        </div>

        <div class="space-y-6 relative z-10 my-8">
            <div class="flex justify-between items-end px-4">
                <div class="flex flex-col items-center">
                    <span class="text-teal-800 text-sm font-bold uppercase tracking-widest">Current</span>
                    <span class="text-6xl font-black text-cyan-600 drop-shadow-md">{currentNote}</span>
                </div>
                
                <div class="w-px h-16 bg-teal-800/20"></div>
                
                <div class="flex flex-col items-center">
                    <span class="text-teal-800 text-sm font-bold uppercase tracking-widest">Target</span>
                    <span class="text-5xl font-black text-teal-800/50 drop-shadow-sm">{targetNoteStr}</span>
                </div>
            </div>
        </div>

        <div class="relative z-10 mt-6">
            <!-- Updated to use Svelte 5 onclick -->
            <button 
                onclick={initializeAudio}
                disabled={isProcessing}
                class="w-full relative overflow-hidden bg-linear-to-b from-cyan-400 to-blue-500 rounded-full py-4 px-6 text-white text-lg font-bold shadow-[inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-4px_8px_rgba(0,0,0,0.2),0_4px_10px_rgba(0,100,200,0.4)] hover:from-cyan-300 hover:to-blue-400 transition-all active:shadow-[inset_0_4px_8px_rgba(0,0,0,0.3)] active:translate-y-0.5 group disabled:opacity-75 disabled:cursor-not-allowed"
            >
                <span class="relative z-10 drop-shadow-md group-hover:drop-shadow-lg transition-all">
                    {isProcessing ? "Listening..." : "Start Tuner"}
                </span>
                <div class="absolute top-1 left-1/2 -translate-x-1/2 w-[90%] h-[40%] bg-linear-to-b from-white/70 to-transparent rounded-full pointer-events-none"></div>
            </button>
        </div>
    </div>
    
    <div class="fixed top-20 left-20 w-32 h-32 bg-white/20 rounded-full blur-xl pointer-events-none"></div>
    <div class="fixed bottom-20 right-20 w-48 h-48 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none"></div>
</div>