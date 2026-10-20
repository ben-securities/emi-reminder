const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const duration = 1.4; // 1.4 seconds
const totalSamples = Math.floor(sampleRate * duration);
const buffer = Buffer.alloc(44 + totalSamples * 2);

// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + totalSamples * 2, 4);
buffer.write('WAVE', 8);

// fmt chunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
buffer.writeUInt16LE(1, 20);  // audioFormat (1 for PCM)
buffer.writeUInt16LE(1, 22);  // numChannels (1 for Mono)
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28); // byteRate
buffer.writeUInt16LE(2, 32);  // blockAlign
buffer.writeUInt16LE(16, 34); // bitsPerSample

// data chunk
buffer.write('data', 36);
buffer.writeUInt32LE(totalSamples * 2, 40);

// Bell / Chime notes: [startTime, freq, duration, amplitude]
// 3 pleasant bell strikes: A5 (880Hz), C#6 (1108Hz), E6 (1318Hz)
const notes = [
  { start: 0.0, freq: 880.0, dur: 0.6, amp: 0.45 },
  { start: 0.18, freq: 1108.7, dur: 0.6, amp: 0.48 },
  { start: 0.36, freq: 1318.5, dur: 0.9, amp: 0.55 },
  { start: 0.36, freq: 2637.0, dur: 0.5, amp: 0.15 } // harmonic shimmer
];

for (let i = 0; i < totalSamples; i++) {
  const t = i / sampleRate;
  let sample = 0;

  for (const n of notes) {
    if (t >= n.start && t < n.start + n.dur) {
      const noteT = t - n.start;
      // Attack: fast 0.005s ramp up
      const attack = Math.min(1.0, noteT / 0.005);
      // Exponential decay
      const decay = Math.exp(-noteT * 4.5);
      const env = attack * decay * n.amp;
      sample += Math.sin(2 * Math.PI * n.freq * noteT) * env;
    }
  }

  // Soft clip to prevent any distortion
  const clipped = Math.max(-0.95, Math.min(0.95, sample));
  const intSample = Math.floor(clipped * 32767);
  buffer.writeInt16LE(intSample, 44 + i * 2);
}

const targets = [
  path.join(__dirname, 'android', 'app', 'src', 'main', 'res', 'raw', 'reminder_sound.wav'),
  path.join(__dirname, 'reminder_sound.wav'),
  path.join(__dirname, 'www', 'reminder_sound.wav')
];

targets.forEach(tgt => {
  const dir = path.dirname(tgt);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tgt, buffer);
  console.log(`Generated: ${tgt} (${buffer.length} bytes)`);
});
