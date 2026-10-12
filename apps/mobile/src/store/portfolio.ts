// Portafolio activo elegido por el usuario (o la vista General). Se
// recuerda entre aperturas de la app; no es dato sensible.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface PortfolioSelectionState {
  activePortfolioId: string | null;
  setActivePortfolioId: (id: string) => void;
}

export const usePortfolioSelection = create<PortfolioSelectionState>()(
  persist(
    (set) => ({
      activePortfolioId: null,
      setActivePortfolioId: (id) => set({ activePortfolioId: id }),
    }),
    { name: 'val.portfolioSelection', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
