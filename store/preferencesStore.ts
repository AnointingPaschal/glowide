import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PreferencesState {
  // Terminal behavior
  autoOpenTerminalOnCompile: boolean;
  autoOpenTerminalOnDeploy: boolean;
  terminalFontSize: 11 | 12 | 13 | 14;

  // AI Assistant
  rememberAIPermission: boolean;              // if true, skip the per-session prompt and reuse the saved choice
  aiDefaultPermission: "unset" | "granted" | "denied";

  setAutoOpenTerminalOnCompile: (v: boolean) => void;
  setAutoOpenTerminalOnDeploy: (v: boolean) => void;
  setTerminalFontSize: (v: 11 | 12 | 13 | 14) => void;
  setRememberAIPermission: (v: boolean) => void;
  setAIDefaultPermission: (v: "unset" | "granted" | "denied") => void;
  resetAIPermissionMemory: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      autoOpenTerminalOnCompile: true,
      autoOpenTerminalOnDeploy: true,
      terminalFontSize: 12,
      rememberAIPermission: false,
      aiDefaultPermission: "unset",

      setAutoOpenTerminalOnCompile: (v) => set({ autoOpenTerminalOnCompile: v }),
      setAutoOpenTerminalOnDeploy:  (v) => set({ autoOpenTerminalOnDeploy: v }),
      setTerminalFontSize:          (v) => set({ terminalFontSize: v }),
      setRememberAIPermission:      (v) => set({ rememberAIPermission: v }),
      setAIDefaultPermission:       (v) => set({ aiDefaultPermission: v }),
      resetAIPermissionMemory:      () => set({ aiDefaultPermission: "unset" }),
    }),
    { name: "glowide-preferences" }
  )
);
