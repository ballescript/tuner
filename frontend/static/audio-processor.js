import init, { PitchDetector } from './wasm/wasm_processor.js';

class PitchDetectorProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.detector = null;
        this.frameCount = 0;
        
        this.port.onmessage = async (event) => {
            if (event.data.type === 'init-wasm') {
                // We can now safely use the statically imported 'init'
                await init(event.data.wasmModule);
                this.detector = new PitchDetector(event.data.sampleRate);
                this.port.postMessage({ type: 'ready' });
            }
        };
    }

    process(inputs) {
        if (!this.detector) return true; 

        const input = inputs[0];
        
        if (input && input.length > 0 && input[0].length > 0) {
            const hz = this.detector.detect_pitch(input[0]);
            
            this.frameCount++;
            if (this.frameCount % 15 === 0 && hz > 0) {
                this.port.postMessage({ type: 'pitch', hz: hz });
            }
        }

        return true;
    }
}

registerProcessor('pitch-detector-processor', PitchDetectorProcessor);