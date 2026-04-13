import { useState, useRef, useEffect } from 'react';
import type { AtlasState } from './MicButton';

interface ATLASVoiceModalProps {
  open: boolean;
  state: AtlasState;
  transcript: string;
  analyserNode: AnalyserNode | null;
  onClose: () => void;
}

// ─── Wave hook ───────────────────────────────────────────────────────────────

const BAR_COUNT = 48;

function useRealtimeWave(analyserNode: AnalyserNode | null, state: AtlasState) {
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0.02));
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    // Processing: pulso flat animado
    if (state === 'processing') {
      let t = 0;
      const animate = () => {
        t += 0.04;
        setBars(
          Array.from({ length: BAR_COUNT }, (_, i) => {
            const center = (i - BAR_COUNT / 2) / (BAR_COUNT / 2);
            const envelope = Math.exp(-center * center * 4);
            const wave = 0.22 + Math.sin(t + i * 0.35) * 0.14 * envelope;
            return Math.max(0.08, Math.min(0.42, wave));
          }),
        );
        frameRef.current = requestAnimationFrame(animate);
      };
      frameRef.current = requestAnimationFrame(animate);
      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
      };
    }

    // Idle ou sem analyser: zera as barras
    if (state === 'idle' || !analyserNode) {
      setBars(Array(BAR_COUNT).fill(0.02));
      return;
    }

    // Listening / Speaking: lê frequências reais
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

    const readFrequencies = () => {
      analyserNode.getByteFrequencyData(dataArray);
      const binCount = dataArray.length;

      setBars(
        Array.from({ length: BAR_COUNT }, (_, i) => {
          // Distribuição logarítmica — mais resolução nos graves (voz humana)
          const start = Math.floor((i / BAR_COUNT) * binCount * 0.75);
          const end = Math.floor(((i + 1) / BAR_COUNT) * binCount * 0.75);
          const slice = dataArray.slice(start, end + 1);
          const avg = slice.reduce((s, v) => s + v, 0) / (slice.length || 1);

          // Envelope centralizado + normalização 0–255 → 0–1
          const center = (i - BAR_COUNT / 2) / (BAR_COUNT / 2);
          const envelope = Math.exp(-center * center * 1.8);
          return Math.max(0.02, (avg / 255) * envelope);
        }),
      );

      frameRef.current = requestAnimationFrame(readFrequencies);
    };
    frameRef.current = requestAnimationFrame(readFrequencies);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [analyserNode, state]);

  return bars;
}

// ─── Paleta de cores ─────────────────────────────────────────────────────────

const WAVE_COLORS: Record<AtlasState, { from: string; to: string }> = {
  idle:       { from: '#1e3a2f', to: '#0f2318' },
  listening:  { from: '#059669', to: '#34d399' },
  processing: { from: '#047857', to: '#6ee7b7' },
  speaking:   { from: '#10b981', to: '#a7f3d0' },
};

const ORB_CONFIG: Record<AtlasState, { bg: string; glow: string; animation: string }> = {
  idle: {
    bg: 'radial-gradient(circle, #1e3a2f, #0f2318)',
    glow: 'rgba(16,185,129,0.1)',
    animation: 'none',
  },
  listening: {
    bg: 'radial-gradient(circle, #34d399, #10b981)',
    glow: 'rgba(16,185,129,0.7)',
    animation: 'atlasPulse 1.6s ease-in-out infinite',
  },
  processing: {
    bg: 'radial-gradient(circle, #6ee7b7, #34d399)',
    glow: 'rgba(52,211,153,0.5)',
    animation: 'none',
  },
  speaking: {
    bg: 'radial-gradient(circle, #a7f3d0, #6ee7b7)',
    glow: 'rgba(110,231,183,0.8)',
    animation: 'atlasBeat 0.7s ease-in-out infinite alternate',
  },
};

const STATE_LABELS: Record<AtlasState, { title: string; sub: string }> = {
  idle:       { title: 'ATLAS pronto',    sub: 'Clique no microfone para falar' },
  listening:  { title: 'Ouvindo...',      sub: 'Clique no microfone para parar' },
  processing: { title: 'Processando...', sub: 'Interpretando seu comando' },
  speaking:   { title: 'ATLAS falando',  sub: 'Aguarde a resposta' },
};

const RING_COLORS: Partial<Record<AtlasState, string>> = {
  listening: 'rgba(16,185,129,0.45)',
  speaking:  'rgba(110,231,183,0.5)',
};

// ─── Componente ──────────────────────────────────────────────────────────────

export default function ATLASVoiceModal({
  open,
  state,
  transcript,
  analyserNode,
  onClose,
}: ATLASVoiceModalProps) {
  const bars = useRealtimeWave(analyserNode, state);
  const orb = ORB_CONFIG[state];
  const label = STATE_LABELS[state];
  const waveColor = WAVE_COLORS[state];
  const ringColor = RING_COLORS[state];

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes atlasFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes atlasSlideUp {
          from { transform: translateY(32px) scale(0.96); opacity: 0 }
          to   { transform: translateY(0) scale(1); opacity: 1 }
        }
        @keyframes atlasPulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
        @keyframes atlasBeat    { from{transform:scale(1)} to{transform:scale(1.13)} }
        @keyframes atlasRing    { 0%{transform:scale(0.85);opacity:0.8} 100%{transform:scale(1.4);opacity:0} }
        @keyframes atlasSpin    { to{transform:rotate(360deg)} }
        @keyframes atlasIn      { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
      `}</style>

      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          backdropFilter: 'blur(18px)',
          background: 'rgba(2,8,20,0.88)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'atlasFadeIn 0.25s ease',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Card */}
        <div
          style={{
            width: 'min(420px, 92vw)',
            background: 'rgba(10,20,35,0.97)',
            border: '1px solid rgba(16,185,129,0.18)',
            borderRadius: 28,
            padding: '36px 28px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            animation: 'atlasSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {/* AtlasOrb */}
          <div
            style={{
              position: 'relative',
              width: 96,
              height: 96,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Anéis de expansão */}
            {ringColor && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    inset: -8,
                    borderRadius: '50%',
                    border: `2px solid ${ringColor}`,
                    animation: 'atlasRing 2s ease-out infinite',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: -8,
                    borderRadius: '50%',
                    border: `2px solid ${ringColor}`,
                    animation: 'atlasRing 2s ease-out infinite 0.7s',
                  }}
                />
              </>
            )}

            {/* Orbe */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: orb.bg,
                boxShadow: `0 0 32px ${orb.glow}, 0 0 64px ${orb.glow}`,
                animation: orb.animation,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Spinner do estado processing */}
              {state === 'processing' && (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    border: '3px solid rgba(110,231,183,0.25)',
                    borderTopColor: '#6ee7b7',
                    animation: 'atlasSpin 0.9s linear infinite',
                  }}
                />
              )}
            </div>
          </div>

          {/* WaveBars */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              height: 56,
              width: '100%',
            }}
          >
            {bars.map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderRadius: 4,
                  background: `linear-gradient(to top, ${waveColor.from}, ${waveColor.to})`,
                  height: `${state === 'processing' ? Math.max(16, h * 140) : Math.max(4, h * 100)}%`,
                  transition: 'height 0.06s ease',
                }}
              />
            ))}
          </div>

          {/* StateLabel */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                color: '#a7f3d0',
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              {label.title}
            </div>
            <div
              style={{
                color: 'rgba(167,243,208,0.55)',
                fontSize: 13,
                marginTop: 4,
              }}
            >
              {label.sub}
            </div>
          </div>

          {/* TranscriptBubble */}
          {transcript && state !== 'idle' && (
            <div
              style={{
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 12,
                padding: '10px 16px',
                color: 'rgba(167,243,208,0.8)',
                fontSize: 14,
                lineHeight: 1.5,
                width: '100%',
                textAlign: 'center',
                animation: 'atlasIn 0.3s ease',
              }}
            >
              &ldquo;{transcript}&rdquo;
            </div>
          )}

          {/* Botão Encerrar */}
          <button
            onClick={onClose}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'rgba(16,185,129,0.22)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'rgba(16,185,129,0.12)';
            }}
            style={{
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 12,
              color: '#34d399',
              fontSize: 14,
              fontWeight: 500,
              padding: '10px 28px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            Encerrar
          </button>
        </div>
      </div>
    </>
  );
}
