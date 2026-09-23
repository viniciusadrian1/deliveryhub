/**
 * Utilitário de som para alertas de novos pedidos no DeliveryHub.
 * Sintetiza o som via Web Audio API de forma nativa e confiável,
 * sem depender de arquivos externos ou codecs bloqueados pelo navegador.
 */

let cachedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!cachedAudioCtx || cachedAudioCtx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        cachedAudioCtx = new AudioCtx();
      }
    }
    if (cachedAudioCtx && cachedAudioCtx.state === 'suspended') {
      void cachedAudioCtx.resume();
    }
    return cachedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Toca o som de campainha de novo pedido (chime de dois tons em harmonia: Ré5 -> Lá5).
 * Soa como os alertas clássicos de terminais de delivery (iFood, POS).
 */
export function playOrderAlert(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Primeiro tom: 587.33 Hz (D5) - ataque suave
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.36);

    // Segundo tom (mais agudo e brilhante): 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);

    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.45, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.72);
  } catch (err) {
    console.warn('[sound] Não foi possível reproduzir o som:', err);
  }
}

/**
 * Alerta sonoro específico para o KDS (Cozinha).
 * Três notas ascendentes com harmônicos ricos (Mi5 -> Sol5 -> Dó6 / Dó Maior),
 * projetado para cortar o ruído ambiente de cozinhas e avisar a equipe imediatamente.
 */
export function playKitchenAlert(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [
      { freq: 659.25, time: 0, dur: 0.22, vol: 0.45 },     // Mi (E5)
      { freq: 783.99, time: 0.15, dur: 0.22, vol: 0.5 },   // Sol (G5)
      { freq: 1046.50, time: 0.30, dur: 0.65, vol: 0.6 },  // Dó agudo (C6)
    ];

    for (const n of notes) {
      const startAt = now + n.time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle'; // timbre com harmônicos para corte acústico
      osc.frequency.setValueAtTime(n.freq, startAt);

      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.linearRampToValueAtTime(n.vol, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startAt);
      osc.stop(startAt + n.dur + 0.05);
    }
  } catch (err) {
    console.warn('[sound] Erro ao tocar alerta de cozinha:', err);
  }
}

/** Desbloqueia o AudioContext no primeiro gesto do usuário na tela (touch ou clique). */
export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume();
  }
}

