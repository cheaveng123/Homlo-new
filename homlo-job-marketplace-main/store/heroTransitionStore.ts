import { create } from 'zustand';

type HeroRect = { x: number; y: number; width: number; height: number };

interface HeroTransitionState {
  active: boolean;
  uri: string | null;
  startRect: HeroRect | null;
  start: (uri: string, rect: HeroRect) => void;
  clear: () => void;
}

export const useHeroTransitionStore = create<HeroTransitionState>((set) => ({
  active: false,
  uri: null,
  startRect: null,
  start: (uri, rect) => set({ active: true, uri, startRect: rect }),
  clear: () => set({ active: false, uri: null, startRect: null }),
}));