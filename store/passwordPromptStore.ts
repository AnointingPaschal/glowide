import { create } from "zustand";

/**
 * A single, app-wide password prompt for signing with a local self-custody
 * wallet. Mounted once (see PasswordPromptModal in Providers), so any
 * component anywhere — chat, DeFi, editor — can call requestPassword() and
 * get a real modal without wiring its own UI every time.
 */
interface PasswordPromptState {
  active: boolean;
  resolve: ((pw: string | null) => void) | null;
  open: (resolve: (pw: string | null) => void) => void;
  close: () => void;
}

export const usePasswordPromptStore = create<PasswordPromptState>((set) => ({
  active: false,
  resolve: null,
  open: (resolve) => set({ active: true, resolve }),
  close: () => set({ active: false, resolve: null }),
}));

export function requestPassword(): Promise<string | null> {
  return new Promise((resolve) => {
    usePasswordPromptStore.getState().open(resolve);
  });
}
