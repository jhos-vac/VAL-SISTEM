// Selección explícita de "portafolio activo" (RFW-03: cambiar entre
// portafolios). En memoria únicamente (igual que auth-store: se
// reinicia al recargar la página) — no hay nada delicado en persistirlo,
// pero tampoco hace falta: useDefaultPortfolio ya resuelve un default
// razonable (el marcado isDefault) mientras no haya selección explícita.
import { create } from "zustand";

interface PortfolioSelectionState {
  activePortfolioId: string | null;
  setActivePortfolioId: (id: string) => void;
}

export const usePortfolioSelectionStore = create<PortfolioSelectionState>((set) => ({
  activePortfolioId: null,
  setActivePortfolioId: (id) => set({ activePortfolioId: id }),
}));
