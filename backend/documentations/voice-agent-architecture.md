# Voice agent — speech-to-text and text-to-speech

The voice channel is a full-duplex WebSocket bridge between the customer's
browser and OpenAI's Realtime API. It reuses the same tools, prompts, and
persistence layer as the text agent — the only thing that changes is the
transport.

The implementation lives in `backend/app/voice.py`, exposed at
`WS /api/voice/{conversation_id}` (`backend/app/main.py`). The frontend
side is in `frontend/app/components/voiceClient.ts` and
`frontend/app/components/MicButton.tsx`, hosted on the `/customer-mic`
route.

## Providers and models

| Concern | Provider / model | Notes |
|---|---|---|
| Speech-to-text (STT) | OpenAI Whisper (`whisper-1`) | Server-side transcription of each user utterance. |
| Speech-to-speech (LLM + TTS) | OpenAI Realtime API | Generates the spoken reply directly from the conversation context. |
| Voice | `verse` (default) | Configurable via `OPENAI_REALTIME_VOICE`. |
| Voice activity detection | Server-side `server_vad`, threshold 0.5 | OpenAI Realtime decides when the user has stopped speaking. |

The Realtime session is configured once at the start of each WebSocket
connection (modalities, voice, transcription model, VAD settings).

## Connection lifecycle

1. The browser opens `WS /api/voice/{conversation_id}`. Passing
   `conversation_id="new"` starts a fresh conversation; the assigned id
   comes back as the first JSON frame to the client.
2. The backend opens a second WebSocket to OpenAI Realtime and sends the
   session configuration plus a system message that mirrors the text
   agent's instructions (so behaviour stays consistent across channels).
3. Two async pumps run concurrently for the lifetime of the call.

## The two async pumps

### Client → OpenAI (`_pump_client_to_openai`)

- Receives **binary** frames containing raw PCM16 audio at 24 kHz mono
  from the browser microphone.
- Base64-encodes each chunk and forwards it as an
  `input_audio_buffer.append` event to OpenAI Realtime.
- Also handles JSON control frames from the client — currently the only
  recognised event is `{ "type": "interrupt" }`, which sends a
  `response.cancel` to the Realtime session so the assistant stops
  talking mid-sentence.

### OpenAI → Client (`_pump_openai_to_client`)

Routes OpenAI Realtime events back to the browser as a mix of binary and
JSON frames:

| Realtime event | Sent to client as | Purpose |
|---|---|---|
| audio delta | binary PCM16 frame | Streamed playback of the assistant's voice. |
| `conversation.item.input_audio_transcription.completed` | `{ type: "user_transcript_done", text }` | Whisper finished transcribing what the user said. |
| `response.audio_transcript.delta` / `.done` | `{ type: "agent_text_delta" }` / `{ type: "agent_text_done", text }` | Live captions of the assistant reply. |
| tool call lifecycle | `{ type: "tool_call", name, arguments }` | Surfaces function-calls to the UI for live debugging. |
| state changes after a tool runs | `{ type: "state_update", state }` | The UI can update the live transcript / dashboard preview without polling. |
| `response.done` | (triggers persistence) | End of one assistant turn. |

## Shared state with the text agent

When the Realtime API emits `response.done`, the bridge promotes the
working `TurnContext` snapshot to `last_turn` via
`cs.apply_turn(state, ctx.snapshot())` — exactly the same call the text
agent's `run_turn` uses. State, LLM log, and the dashboard index are then
persisted with the same helpers.

That means a conversation can move between text and voice without losing
state: the dashboard sees the same `last_turn.quote`, the same booking,
the same urgency, regardless of which channel sent the most recent turn.

## Browser side

`voiceClient.ts` handles the local audio plumbing:

- Requests microphone access via `navigator.mediaDevices.getUserMedia`.
- Resamples the browser's native rate down to 24 kHz mono and encodes
  to PCM16.
- Sends PCM16 frames over the WebSocket as binary messages.
- Schedules incoming audio for gapless playback through an
  `AudioContext`.
- Emits `onMicLevel` callbacks so the UI can show a live input meter.

`MicButton.tsx` is a small state machine driving the visible button —
`idle`, `connecting`, `listening`, `thinking`, `speaking` — and pulses on
mic level while in `listening`. There is no push-to-talk: the call runs
continuously and the VAD on the server decides when an utterance ends.

## What is not yet wired

- **True barge-in.** The current `interrupt` event cancels the in-flight
  response but does not fully mix overlapped user/assistant audio.
- **Phone channel.** The voice transport is browser-only for now; a
  Twilio bridge (SMS or PSTN) is on the spec's stretch-goals list.
- **Voice authentication or caller-id binding.** Each WebSocket is
  anonymous and trusted at the transport level.

## Where to look in the code

| Concern | File |
|---|---|
| WebSocket bridge, pumps, session config | `backend/app/voice.py` |
| HTTP/WS surface (`/api/voice/{id}`) | `backend/app/main.py` |
| Browser audio + WS client | `frontend/app/components/voiceClient.ts` |
| Mic UI state machine | `frontend/app/components/MicButton.tsx` |
| Hosting page | `frontend/app/customer-mic/` |
