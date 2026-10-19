// TEMPORAL: paleta elegida para comparar opciones de color en el teléfono.
// Se recuerda entre aperturas; no es dato sensible.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PaletteName = 'verde' | 'grafito' | 'cafe' | 'pizarra';

interface AppearanceState {
  palette: PaletteName;
  setPalette: (palette: PaletteName) => void;
}

export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      palette: 'verde',
      setPalette: (palette) => set({ palette }),
    }),
    { name: 'val.appearance', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
