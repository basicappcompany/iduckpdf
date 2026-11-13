// Loads pdf.js (self-hosted, same origin) and exposes it as window.pdfjsLib for src/engine/render.ts.
import * as lib from './pdf.min.mjs';

lib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs';
window.pdfjsLib = lib;
