declare module 'soundtouchjs' {
  export class PitchShifter {
    constructor(context: AudioContext, buffer: AudioBuffer, grainSize?: number);
    tempo: number;
    pitchSemitones: number;
    percentagePlayed: number;
    connect(node: AudioNode): void;
    disconnect(): void;
    on(event: string, cb: (data: any) => void): void;
  }
}
