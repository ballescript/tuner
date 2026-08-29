import init, { PitchDetector } from '/tuner/wasm/wasm_processor.js';

class PitchDetectorProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.detector = null;

        // TRACER 1: Did the Worklet even boot?
        this.port.postMessage({ type: 'error', message: 'TRACER: Worklet Constructor Ran' });

        this.port.onmessage = async (event) => {
            // TRACER 2: Did it receive the WASM module?
            this.port.postMessage({ type: 'error', message: 'TRACER: Received message in Worklet' });

            if (event.data.type === 'init-wasm') {
                try {
                    // TRACER 3: About to run Rust
                    this.port.postMessage({ type: 'error', message: 'TRACER: Starting init()...' });
                    
                    await init(event.data.wasmModule);
                    
                    // TRACER 4: Rust booted successfully
                    this.port.postMessage({ type: 'error', message: 'TRACER: init() finished. Creating detector.' });
                    
                    this.detector = PitchDetector.new(event.data.sampleRate);
                    
                    // TRACER 5: Detector created
                    this.port.postMessage({ type: 'error', message: 'TRACER: Detector created!' });
                    
                    this.port.postMessage({ type: 'ready' });
                } catch (err) {
                    this.port.postMessage({ 
                        type: 'error', 
                        message: "WASM INIT FAIL: " + (err.message || String(err)) 
                    });
                }
            }
        };
    }

    process(inputs) {
        if (!this.detector) return true;
        
        const input = inputs[0];
        if (input && input.length > 0 && input[0].length > 0) {
            const pitch = this.detector.detect_pitch(input[0]);
            if (pitch > 0) {
                this.port.postMessage({ type: 'pitch', hz: pitch });
            }
        }
        return true;
    }
}

registerProcessor('pitch-detector-processor', PitchDetectorProcessor);