import React, { useEffect, useRef, useState } from 'react';
import { getLiveClient } from './services';
import { Mic, MicOff, X, Activity } from 'lucide-react';

// Type stubs for Gemini Live API
interface LiveServerMessage {
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
        };
      }>;
    };
  };
}

enum Modality {
  AUDIO = 'AUDIO',
  TEXT = 'TEXT'
}

// Audio Utilities
function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

function base64EncodeAudio(float32Array: Float32Array): string {
  const int16Array = floatTo16BitPCM(float32Array);
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeAudio(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const LiveView: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);

  // Audio Context Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null); // To store the active session

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const connect = async () => {
    try {
      const ai = getLiveClient();

      // Setup Audio Contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const source = inputCtx.createMediaStreamSource(stream);
      const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      source.connect(scriptProcessor);
      scriptProcessor.connect(inputCtx.destination);

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: "You are KAA CRM Assistant. Be concise, professional, and helpful.",
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            setIsConnected(true);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputCtx) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);

              const audioBytes = decodeAudio(base64Audio);
              const audioBuffer = await decodeAudioData(audioBytes, outputCtx, 24000, 1);

              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
            }
          },
          onclose: () => {
            console.log("Gemini Live Closed");
            setIsConnected(false);
          },
          onerror: (err) => {
            console.error("Gemini Live Error", err);
            setIsConnected(false);
          }
        }
      });

      // Stream Audio Input
      scriptProcessor.onaudioprocess = (e) => {
        if (isMuted) return;
        const inputData = e.inputBuffer.getChannelData(0);

        // Simple visualizer volume calculation
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        const rms = Math.sqrt(sum / inputData.length);
        setVolume(Math.min(rms * 5, 1)); // Scale for UI

        const base64Data = base64EncodeAudio(inputData);

        sessionPromise.then(session => {
          sessionRef.current = session;
          session.sendRealtimeInput({
            media: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Data
            }
          });
        });
      };

    } catch (error) {
      console.error("Failed to connect live session", error);
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
      // Unfortunately standard API doesn't expose clean close on session object easily in this version, 
      // but stopping streams is key.
      sessionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }
    setIsConnected(false);
    setVolume(0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 animate-fade-in">
        <div className="w-32 h-32 rounded-full bg-indigo-50 flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-20"></div>
          <Mic className="w-12 h-12 text-indigo-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-4">KAA Live Assistant</h2>
        <p className="text-slate-500 mb-8 text-center max-w-md">Start a real-time voice conversation with your CRM. Ask about pipeline updates, contact details, or schedule meetings.</p>
        <button
          onClick={connect}
          className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-200 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
        >
          <Mic className="w-5 h-5" />
          Tap to Connect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-900/5 backdrop-blur-3xl relative overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-indigo-500/10 to-purple-500/10"></div>

      {/* Visualizer Ring */}
      <div className="relative z-10 w-64 h-64 flex items-center justify-center">
        {/* Dynamic Rings based on volume */}
        <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl transition-all duration-100" style={{ opacity: 0.2 + volume, transform: `scale(${1 + volume * 0.5})` }}></div>
        <div className="absolute inset-4 bg-white/20 backdrop-blur-md rounded-full border border-white/30 flex items-center justify-center shadow-inner">
          <div className="w-32 h-32 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/40">
            <Activity className={`w-12 h-12 ${volume > 0.1 ? 'animate-pulse' : ''}`} />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-12 text-center">
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Listening...</h3>
        <p className="text-slate-500">KAA is ready for your command</p>
      </div>

      {/* Controls */}
      <div className="relative z-10 mt-16 flex items-center gap-6">
        <button
          onClick={toggleMute}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-rose-100 text-rose-600' : 'bg-white text-slate-700 hover:bg-slate-50'} shadow-lg`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button
          onClick={disconnect}
          className="w-20 h-20 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xl shadow-rose-200 hover:bg-rose-700 hover:scale-105 transition-all"
        >
          <X className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};
