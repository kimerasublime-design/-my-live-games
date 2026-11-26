#!/usr/bin/env node
/**
 * Audita os 40 sprites PNG da corrida: dimensões, transparência e conteúdo
 * encostado nas bordas. Não altera nenhum arquivo.
 *
 * Uso: node scripts/audit-horse-sprites.mjs
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve("public/games/horse-racing/assets/horses");
const horses = ["horse-01", "horse-02", "horse-03", "horse-04", "horse-05"];
const frames = 8;
const expectedWidth = 320;
const expectedHeight = 256;

function readPng(file) {
  const data = fs.readFileSync(file);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!data.subarray(0, 8).equals(signature)) throw new Error("assinatura PNG inválida");
  let width, height, bitDepth, colorType, interlace;
  const idats = [];
  for (let p = 8; p < data.length;) {
    const length = data.readUInt32BE(p);
    const type = data.toString("ascii", p + 4, p + 8);
    const chunk = data.subarray(p + 8, p + 8 + length);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      interlace = chunk[12];
    } else if (type === "IDAT") idats.push(chunk);
    p += length + 12;
    if (type === "IEND") break;
  }
  if (bitDepth !== 8 || ![6, 2].includes(colorType) || interlace !== 0) {
    throw new Error(`formato não suportado (bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace})`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const pixels = Buffer.alloc(height * stride);
  let offset = 0;
  const paeth = (a, b, c) => {
    const q = a + b - c, da = Math.abs(q - a), db = Math.abs(q - b), dc = Math.abs(q - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[offset++];
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[offset++];
      const a = x >= channels ? pixels[row + x - channels] : 0;
      const b = y ? pixels[row - stride + x] : 0;
      const c = y && x >= channels ? pixels[row - stride + x - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = Math.floor((a + b) / 2);
      else if (filter === 4) predictor = paeth(a, b, c);
      else if (filter !== 0) throw new Error("filtro PNG desconhecido: " + filter);
      pixels[row + x] = (value + predictor) & 255;
    }
  }
  return { width, height, channels, pixels, stride };
}

let failed = false;
for (const horse of horses) {
  for (let n = 1; n <= frames; n++) {
    const file = path.join(root, horse, `frame-${String(n).padStart(2, "0")}.png`);
    try {
      const png = readPng(file);
      let minX = png.width, minY = png.height, maxX = -1, maxY = -1;
      let edgePixels = 0, opaquePixels = 0;
      for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
          const i = y * png.stride + x * png.channels;
          const alpha = png.channels === 4 ? png.pixels[i + 3] : 255;
          if (alpha === 0) continue;
          opaquePixels++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (x === 0 || y === 0 || x === png.width - 1 || y === png.height - 1) edgePixels++;
        }
      }
      const dimensionsOk = png.width === expectedWidth && png.height === expectedHeight;
      const touchesEdge = edgePixels > 0;
      const status = !dimensionsOk || touchesEdge || opaquePixels === 0 ? "ATENÇÃO" : "OK";
      if (status !== "OK") failed = true;
      console.log(`${status} ${horse}/frame-${String(n).padStart(2, "0")}.png | ${png.width}x${png.height} | alphaBounds=${minX},${minY}..${maxX},${maxY} | edgePixels=${edgePixels}`);
    } catch (error) {
      failed = true;
      console.log(`ERRO ${horse}/frame-${String(n).padStart(2, "0")}.png | ${error.message}`);
    }
  }
}
console.log(failed ? "\\nAuditoria concluída: há arquivos que precisam de inspeção visual." : "\\nAuditoria concluída: dimensões e margens transparentes aprovadas.");
if (failed) process.exitCode = 1;
