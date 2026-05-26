// Voice client — bridges browser mic + speaker to the backend's
// /api/voice/{conversation_id} WebSocket (which itself ponts to OpenAI
// Realtime). Audio in/out is PCM16 mono 24 kHz.

import type { LastTurn } from "./types";

const TARGET_SAMPLE_RATE = 24000;

export type VoiceEvent =
  | { type: "conversation_started"; conversation_id: string }
  | { type: "session_ready" }
  | { type: "user_speaking" }
  | { type: "user_stopped" }
  | { type: "user_transcript_done"; text: string }
  | { type: "agent_text_delta"; text: string }
  | { type: "agent_text_done"; text: string }
  | { type: "state_update"; last_turn: LastTurn }
  | { type: "tool_call"; name: string; arguments: unknown; result: string }
  | { type: "error"; message: string };

export interface VoiceClientCallbacks {
  onEvent: (e: VoiceEvent) => void;
  onClosed: () => void;
  onMicLevel?: (level: number) => void;
}

export interface VoiceClientHandle {
  stop: () => Promise<void>;
  isOpen: () => boolean;
}

export async function startVoiceSession(
  apiUrl: string,
  conversationId: string | null,
  cb: VoiceClientCallbacks,
): Promise<VoiceClientHandle> {
  // Ask for mic first — fails fast on denied permission, before we waste
  // a websocket open.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  // Audio capture chain.
  const captureCtx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
  const captureSource = captureCtx.createMediaStreamSource(stream);
  const processor = captureCtx.createScriptProcessor(4096, 1, 1);
  // ScriptProcessor is deprecated but ubiquitous; AudioWorklet is the
  // future, but for V1 this ships immediately and runs everywhere.
  const captureRatio = captureCtx.sampleRate / TARGET_SAMPLE_RATE;

  // Audio playback chain (separate context so we can queue agent audio
  // back-to-back without clashing with capture).
  const playbackCtx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
  let nextStartAt = 0;

  // WebSocket.
  const wsUrl = buildWsUrl(apiUrl, conversationId);
  const ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  let open = true;

  async function stop() {
    if (!open) return;
    open = false;
    try {
      processor.disconnect();
      captureSource.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      await captureCtx.close();
      await playbackCtx.close();
    } catch {
      // ignore
    }
    try {
      ws.close();
    } catch {
      // ignore
    }
    cb.onClosed();
  }

  ws.onopen = () => {
    // Start the mic pipeline once the socket is up.
    processor.onaudioprocess = (e) => {
      if (!open || ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const downsampled =
        captureRatio === 1 ? input : downsample(input, captureRatio);
      const pcm16 = floatTo16BitPCM(downsampled);
      ws.send(pcm16.buffer);

      // Crude mic-level meter (max abs amplitude this frame).
      if (cb.onMicLevel) {
        let peak = 0;
        for (let i = 0; i < downsampled.length; i++) {
          const v = Math.abs(downsampled[i]);
          if (v > peak) peak = v;
        }
        cb.onMicLevel(peak);
      }
    };
    captureSource.connect(processor);
    processor.connect(captureCtx.destination);
  };

  ws.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      // PCM16 24 kHz mono — schedule for gapless playback.
      schedulePlayback(playbackCtx, event.data, () => nextStartAt, (t) => {
        nextStartAt = t;
      });
      return;
    }
    try {
      const payload = JSON.parse(event.data) as VoiceEvent;
      cb.onEvent(payload);
    } catch {
      // ignore non-JSON text frames
    }
  };

  ws.onerror = () => {
    cb.onEvent({ type: "error", message: "WebSocket error" });
  };

  ws.onclose = () => {
    void stop();
  };

  return {
    stop,
    isOpen: () => open && ws.readyState === WebSocket.OPEN,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWsUrl(apiUrl: string, conversationId: string | null): string {
  // http://host → ws://host  /  https://host → wss://host
  const wsBase = apiUrl.replace(/^http/i, (m) => (m.toLowerCase() === "https" ? "wss" : "ws"));
  const id = conversationId ?? "new";
  return `${wsBase}/api/voice/${encodeURIComponent(id)}`;
}

function floatTo16BitPCM(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function downsample(input: Float32Array, ratio: number): Float32Array {
  // Simple averaging downsampler. Good enough for speech, no aliasing
  // artifacts at integer ratios (48 → 24 kHz is the common case).
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  let offset = 0;
  for (let i = 0; i < outLen; i++) {
    const start = offset;
    const end = Math.min(input.length, Math.floor(offset + ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count++;
    }
    out[i] = count ? sum / count : 0;
    offset += ratio;
  }
  return out;
}

function schedulePlayback(
  ctx: AudioContext,
  buffer: ArrayBuffer,
  getNext: () => number,
  setNext: (t: number) => void,
): void {
  const samples = new Int16Array(buffer);
  if (samples.length === 0) return;
  const float = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    float[i] = samples[i] / 0x8000;
  }
  const audioBuffer = ctx.createBuffer(1, float.length, TARGET_SAMPLE_RATE);
  audioBuffer.copyToChannel(float, 0);

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);

  const startAt = Math.max(ctx.currentTime, getNext());
  source.start(startAt);
  setNext(startAt + audioBuffer.duration);
}
