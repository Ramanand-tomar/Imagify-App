import { create } from "zustand";

import type { PickedFile } from "@/hooks/usePdfTool";

interface ScannerStoreState {
  pendingFile: PickedFile | null;
  setPendingFile: (f: PickedFile | null) => void;
}

export const useScannerStore = create<ScannerStoreState>((set) => ({
  pendingFile: null,
  setPendingFile: (f) => set({ pendingFile: f }),
}));
