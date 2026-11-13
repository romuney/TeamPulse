/* Lossless text packing for CSS/HTML only. No executable code is packed.
   UTF-8 -> LZW with a frozen 16-bit dictionary -> base64. The tiny ES5 decoder
   is emitted as regular JavaScript; its output is used only as text/markup. */
'use strict';

function TP_UNPACK(packed) {
  var bytes = atob(packed), dict = [], next = 256, previous = '', output = '';
  var i, code, entry, a, b, c, point, text = '';
  for (i = 0; i < 256; i++) dict[i] = String.fromCharCode(i);
  if (bytes.length % 2) throw new Error('Invalid packed text');
  for (i = 0; i < bytes.length; i += 2) {
    code = (bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1);
    entry = dict[code];
    if (entry === undefined) {
      if (!previous || code !== next) throw new Error('Invalid packed text');
      entry = previous + previous.charAt(0);
    }
    output += entry;
    if (previous && next < 65536) dict[next++] = previous + entry.charAt(0);
    previous = entry;
  }
  // The encoder emits valid UTF-8. Decode without TextDecoder, escape or eval.
  for (i = 0; i < output.length; i++) {
    a = output.charCodeAt(i);
    if (a < 128) text += String.fromCharCode(a);
    else if (a < 224) {
      b = output.charCodeAt(++i);
      text += String.fromCharCode(((a & 31) << 6) | (b & 63));
    } else if (a < 240) {
      b = output.charCodeAt(++i); c = output.charCodeAt(++i);
      text += String.fromCharCode(((a & 15) << 12) | ((b & 63) << 6) | (c & 63));
    } else {
      b = output.charCodeAt(++i); c = output.charCodeAt(++i);
      point = (((a & 7) << 18) | ((b & 63) << 12) | ((c & 63) << 6) |
        (output.charCodeAt(++i) & 63)) - 65536;
      text += String.fromCharCode(55296 + (point >> 10), 56320 + (point & 1023));
    }
  }
  return text;
}

function pack(text) {
  const dict = new Map(), codes = [];
  for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);
  let previous = '', next = 256;
  for (const character of Buffer.from(text, 'utf8').toString('latin1')) {
    const entry = previous + character;
    if (dict.has(entry)) previous = entry;
    else {
      codes.push(dict.get(previous));
      if (next < 65536) dict.set(entry, next++);
      previous = character;
    }
  }
  if (previous) codes.push(dict.get(previous));
  const bytes = Buffer.alloc(codes.length * 2);
  codes.forEach((code, i) => bytes.writeUInt16BE(code, i * 2));
  const packed = bytes.toString('base64');
  // Fail the build, including for invalid Unicode, rather than alter any text.
  if (TP_UNPACK(packed) !== text) throw new Error('Packed text roundtrip mismatch');
  return packed;
}

module.exports = {pack, unpack: TP_UNPACK, runtime: TP_UNPACK.toString()};
