// A card's English out loud: the recorded file (public/audio/cards/<id>.mp3) when there is one, the
// browser's English voice otherwise, so a card is never silent while its recording is pending.
import type { Card } from "../content/content";

let current: HTMLAudioElement | null = null;

export function stopAudio(): void {
  current?.pause();
  current = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

export function hasVoice(): boolean {
  return typeof speechSynthesis !== "undefined";
}

// Speeds: the browser voice's rate, and the recording's playback rate (pitch is kept).
const RATE = { normal: 0.95, slow: 0.6 } as const;
const PLAYBACK = { normal: 1, slow: 0.7 } as const;
export type Speed = keyof typeof RATE;

function say(text: string, speed: Speed): void {
  if (!hasVoice()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = RATE[speed];
  speechSynthesis.speak(utterance);
}

export function playCard(card: Card, speed: Speed = "normal"): void {
  stopAudio();
  if (card.audio) {
    current = new Audio(`/audio/cards/${card.id}.mp3`);
    current.playbackRate = PLAYBACK[speed];
    current.play()?.catch(() => {
      // autoplay blocked until the first tap: the play button still works
    });
    return;
  }
  say(card.en, speed);
}

/** One word (or a short expression) on its own, slowly: the browser voice. */
export function playWord(word: string): void {
  stopAudio();
  say(word, "slow");
}
