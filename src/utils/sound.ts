// chatup/frontend/src/utils/sound.ts

// Global AudioContext singleton
let globalAudioCtx: AudioContext | null = null;
let ringtoneInterval: ReturnType<typeof setInterval> | null = null;

const getAudioContext = (): AudioContext | null => {
    if (!globalAudioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            globalAudioCtx = new AudioContextClass();
        }
    }
    return globalAudioCtx;
};

// Automatically unlock audio upon user's first touch/click anywhere on the window
if (typeof window !== "undefined") {
    const unlockAudio = () => {
        const ctx = getAudioContext();
        if (ctx && ctx.state === "suspended") {
            ctx.resume().catch(() => { });
        }
        window.removeEventListener("click", unlockAudio);
        window.removeEventListener("touchstart", unlockAudio);
        window.removeEventListener("keydown", unlockAudio);
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
}

// Synthesizes a soft, pleasant notification chime
export const playNotificationChime = async () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        if (ctx.state === "suspended") {
            await ctx.resume();
        }

        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(659.25, now);

        osc2.type = "sine";
        osc2.frequency.setValueAtTime(830.61, now + 0.1);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.2);

        osc2.start(now + 0.1);
        osc2.stop(now + 0.6);
    } catch (err) {
        console.warn("Notification audio blocked by browser policy:", err);
    }
};

const playSingleRingPulse = (ctx: AudioContext) => {
    try {
        const now = ctx.currentTime;
        for (let i = 0; i < 2; i++) {
            const start = now + (i * 0.35);
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = "sine";
            osc1.frequency.setValueAtTime(440, start); // A4
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(480, start); // B4

            gain.gain.setValueAtTime(0.12, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(start);
            osc1.stop(start + 0.3);
            osc2.start(start);
            osc2.stop(start + 0.3);
        }
    } catch { }
};

export const startRingtone = async () => {
    stopRingtone();
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === "suspended") await ctx.resume();

        playSingleRingPulse(ctx);
        ringtoneInterval = setInterval(() => {
            if (ctx) playSingleRingPulse(ctx);
        }, 2200);
    } catch (err) {
        console.warn("Ringtone audio blocked:", err);
    }
};

export const stopRingtone = () => {
    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }
};

export const playRingingRingtone = startRingtone;