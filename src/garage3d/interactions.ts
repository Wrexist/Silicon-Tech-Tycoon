// Tap targets for the office: an employee (→ roster) and the vault/Bank (→ finances). The scene
// keeps the invisible hit meshes; this hook owns the handler wiring so every target stops the
// pointer from reaching the scene behind it and forwards to the host callback.
import { useCallback } from "react";
import type { ThreeEvent } from "@react-three/fiber";

export interface HqCallbacks {
  onTapStaff?: (id: string) => void;
  onTapBank?: () => void;
}

export function useHqInteractions({ onTapStaff, onTapBank }: HqCallbacks) {
  const staffTap = useCallback(
    (id: string) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onTapStaff?.(id);
    },
    [onTapStaff],
  );
  const bankTap = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onTapBank?.();
    },
    [onTapBank],
  );
  return { staffTap, bankTap };
}
