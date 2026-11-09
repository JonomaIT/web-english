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

export function playCard(card: Card): void {
  stopAudio();
  if (card.audio) {
    current = new Audio(`/audio/cards/${card.id}.mp3`);
    current.play()?.catch(() => {
      // autoplay blocked until the first tap: the play button still works
    });
    return;
  }
  if (!hasVoice()) return;
  const utterance = new SpeechSynthesisUtterance(card.en);
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  speechSynthesis.speak(utterance);
}
