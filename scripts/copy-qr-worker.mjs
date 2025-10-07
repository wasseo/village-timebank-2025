// scripts/copy-qr-worker.mjs
import { mkdirSync, copyFileSync } from "node:fs";
import { dirname } from "node:path";
const src = "node_modules/qr-scanner/qr-scanner-worker.min.js";
const dest = "public/qr-scanner-worker.min.js";
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log("Copied:", dest);
