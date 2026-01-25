import type { WheelItem } from "./types";

export function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function shuffleArray<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function weightedPick(items: WheelItem[]) {
  const total = items.reduce(
    (sum, item) => sum + Math.max(0.1, item.weight || 0),
    0
  );
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(0.1, item.weight || 0);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Play a notification sound using Web Audio API
 * Creates a pleasant two-tone beep sound
 */
export function playNotificationSound() {
  if (
    typeof window === "undefined" ||
    (!window.AudioContext && !(window as any).webkitAudioContext)
  ) {
    return;
  }

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Create a two-tone notification sound
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // First tone: 800Hz for 100ms
    oscillator1.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator1.type = "sine";
    
    // Second tone: 1000Hz starting at 100ms for 100ms
    oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
    oscillator2.type = "sine";
    oscillator2.start(audioContext.currentTime + 0.1);
    oscillator2.stop(audioContext.currentTime + 0.2);
    
    // Volume envelope
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
    
    oscillator1.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.2);
    
    // Clean up after sound finishes
    setTimeout(() => {
      audioContext.close();
    }, 300);
  } catch (error) {
    // Silently fail if audio context creation fails
    console.debug("Could not play notification sound:", error);
  }
}

/**
 * Play a sound when the voting timer starts
 * Creates an ascending chime sound
 */
export function playTimerStartSound() {
  if (
    typeof window === "undefined" ||
    (!window.AudioContext && !(window as any).webkitAudioContext)
  ) {
    return;
  }

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Create an ascending three-tone chime
    const frequencies = [523.25, 659.25, 783.99]; // C, E, G (C major chord)
    const oscillators: OscillatorNode[] = [];
    const gainNodes: GainNode[] = [];
    
    frequencies.forEach((freq, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.setValueAtTime(freq, audioContext.currentTime);
      osc.type = "sine";
      
      // Stagger the start times for a pleasant ascending effect
      const startTime = audioContext.currentTime + index * 0.08;
      const duration = 0.15;
      
      // Volume envelope with smooth fade
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.125, startTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
      
      oscillators.push(osc);
      gainNodes.push(gain);
    });
    
    // Clean up after sound finishes
    setTimeout(() => {
      audioContext.close();
    }, 500);
  } catch (error) {
    console.debug("Could not play timer start sound:", error);
  }
}

/**
 * Play a sound when the voting timer ends
 * Creates a descending chime sound
 */
export function playTimerEndSound() {
  if (
    typeof window === "undefined" ||
    (!window.AudioContext && !(window as any).webkitAudioContext)
  ) {
    return;
  }

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Create a descending three-tone chime
    const frequencies = [783.99, 659.25, 523.25]; // G, E, C (descending)
    const oscillators: OscillatorNode[] = [];
    const gainNodes: GainNode[] = [];
    
    frequencies.forEach((freq, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.setValueAtTime(freq, audioContext.currentTime);
      osc.type = "sine";
      
      // Stagger the start times for a pleasant descending effect
      const startTime = audioContext.currentTime + index * 0.08;
      const duration = 0.2;
      
      // Volume envelope with smooth fade
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
      
      oscillators.push(osc);
      gainNodes.push(gain);
    });
    
    // Clean up after sound finishes
    setTimeout(() => {
      audioContext.close();
    }, 600);
  } catch (error) {
    console.debug("Could not play timer end sound:", error);
  }
}
