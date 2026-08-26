use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct PitchDetector {
    sample_rate: f32,
}

#[wasm_bindgen]
impl PitchDetector {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Self {
        Self { sample_rate }
    }

    // Returns the detected frequency in Hz, or 0.0 if it's too quiet
    pub fn detect_pitch(&self, input: &[f32]) -> f32 {
        let n = input.len();
        if n == 0 { return 0.0; }

        // 1. Calculate RMS to check volume/silence
        let mut rms = 0.0;
        for &sample in input {
            rms += sample * sample;
        }
        rms = (rms / n as f32).sqrt();

        if rms < 0.01 { return 0.0; } // Threshold for background noise

        // 2. Simple Autocorrelation to find the pitch period
        let mut max_corr = 0.0;
        let mut best_period = 0;
        
        // Look for frequencies between ~80Hz and ~1000Hz (human voice range)
        let min_period = (self.sample_rate / 1000.0) as usize;
        let max_period = (self.sample_rate / 80.0) as usize;

        for lag in min_period..=max_period {
            if lag >= n { break; }
            let mut corr = 0.0;
            for i in 0..(n - lag) {
                corr += input[i] * input[i + lag];
            }
            if corr > max_corr {
                max_corr = corr;
                best_period = lag;
            }
        }

        if max_corr > 0.01 && best_period > 0 {
            self.sample_rate / (best_period as f32)
        } else {
            0.0
        }
    }
}