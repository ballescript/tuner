// Polyfill for Worklet environments that lack TextDecoder
if (typeof globalThis.TextDecoder === 'undefined') {
    globalThis.TextDecoder = class TextDecoder { decode() { return ''; } };
    globalThis.TextEncoder = class TextEncoder { encode() { return new Uint8Array(); } };
}