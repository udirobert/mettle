/**
 * Minimal browser client for Deepgram's Voice Agent API.
 *
 * One WebSocket carries mic audio up and agent audio + transcript events down.
 * Both sides of the conversation surface through onTranscript so the caller
 * can mirror the exchange into shared conversation state.
 */

const AGENT_URL = "wss://agent.deepgram.com/v1/agent/converse";
const SAMPLE_RATE = 24000;

export type VoiceSessionOptions = {
  prompt: string;
  greeting?: string;
  voice?: string;
  onTranscript: (role: "user" | "assistant", text: string) => void;
  onStatus: (status: string) => void;
};

export class DeepgramVoiceSession {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private micStream: MediaStream | null = null;
  private playbackDest: MediaStreamAudioDestinationNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private playingSources: AudioBufferSourceNode[] = [];
  private nextPlayTime = 0;
  // Half-duplex gate: mic frames are dropped until this AudioContext time.
  // Chrome's echo canceller ignores Web Audio playback, so without the gate
  // the mic hears the agent's own voice and the agent talks to itself.
  private micGateUntil = 0;
  private keepAlive: ReturnType<typeof setInterval> | null = null;

  async start(options: VoiceSessionOptions): Promise<void> {
    options.onStatus("requesting microphone…");
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    options.onStatus("connecting…");
    const { token, scheme, error } = await (
      await fetch("/api/deepgram/token")
    ).json();
    if (error) throw new Error(error);

    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    // Play agent audio through an <audio> element instead of the Web Audio
    // graph — that makes it part of the browser's echo-cancellation reference.
    this.playbackDest = this.audioContext.createMediaStreamDestination();
    this.audioEl = new Audio();
    this.audioEl.srcObject = this.playbackDest.stream;
    void this.audioEl.play();
    const ws = new WebSocket(AGENT_URL, [scheme, token]);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "Settings",
          audio: {
            input: { encoding: "linear16", sample_rate: SAMPLE_RATE },
            output: {
              encoding: "linear16",
              sample_rate: SAMPLE_RATE,
              container: "none",
            },
          },
          agent: {
            language: "en",
            greeting: options.greeting,
            listen: { provider: { type: "deepgram", model: "nova-3" } },
            think: {
              provider: { type: "open_ai", model: "gpt-4o-mini", temperature: 0.8 },
              prompt: options.prompt,
            },
            speak: {
              provider: {
                type: "deepgram",
                model: options.voice ?? "aura-2-thalia-en",
              },
            },
          },
        }),
      );
      this.startMic();
      this.keepAlive = setInterval(
        () => ws.readyState === ws.OPEN && ws.send('{"type":"KeepAlive"}'),
        8000,
      );
      options.onStatus("live — speak when ready");
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        const message = JSON.parse(event.data);
        if (message.type === "ConversationText") {
          options.onTranscript(message.role, message.content);
        } else if (message.type === "UserStartedSpeaking") {
          this.flushPlayback(); // barge-in: stop the agent's audio
        } else if (message.type === "Error") {
          options.onStatus(`error: ${message.description ?? "unknown"}`);
        }
      } else {
        this.enqueuePlayback(event.data as ArrayBuffer);
      }
    };

    ws.onclose = () => options.onStatus("session ended");
    ws.onerror = () => options.onStatus("connection error");
  }

  private startMic() {
    if (!this.audioContext || !this.micStream) return;
    const source = this.audioContext.createMediaStreamSource(this.micStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      // Drop mic frames while the agent is speaking (plus a short tail) so
      // speaker bleed never becomes phantom "user" turns.
      const context = this.audioContext;
      if (context && context.currentTime < this.micGateUntil) return;
      const float32 = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
      }
      this.ws.send(int16.buffer);
    };
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  private enqueuePlayback(data: ArrayBuffer) {
    const context = this.audioContext;
    if (!context) return;
    const int16 = new Int16Array(data);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
    const buffer = context.createBuffer(1, float32.length, SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);
    const sourceNode = context.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.connect(this.playbackDest ?? context.destination);
    this.nextPlayTime = Math.max(this.nextPlayTime, context.currentTime);
    sourceNode.start(this.nextPlayTime);
    this.nextPlayTime += buffer.duration;
    this.micGateUntil = this.nextPlayTime + 0.3;
    this.playingSources.push(sourceNode);
    sourceNode.onended = () => {
      this.playingSources = this.playingSources.filter((s) => s !== sourceNode);
    };
  }

  private flushPlayback() {
    for (const sourceNode of this.playingSources) {
      try {
        sourceNode.stop();
      } catch {
        // already stopped
      }
    }
    this.playingSources = [];
    this.nextPlayTime = 0;
    this.micGateUntil = 0;
  }

  stop() {
    if (this.keepAlive) clearInterval(this.keepAlive);
    this.flushPlayback();
    this.processor?.disconnect();
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.audioEl?.pause();
    this.ws?.close();
    this.audioContext?.close();
    this.ws = null;
    this.audioContext = null;
    this.processor = null;
    this.micStream = null;
    this.playbackDest = null;
    this.audioEl = null;
  }
}
