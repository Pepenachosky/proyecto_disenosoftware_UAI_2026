import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./auth";
import { addSaved, fetchSavedIds, removeSaved } from "./data";

type SavedValue = {
  ids: Set<number>;
  toggle(groupId: number): Promise<void>;
  loading: boolean;
  // Grupos con un guardar/quitar en curso (sus botones se deshabilitan).
  pending: Set<number>;
};

const SavedContext = createContext<SavedValue | null>(null);
const EMPTY = new Set<number>();

export function SavedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Los ids cargados quedan asociados a su usuario: si cambia la sesión, los
  // de otro usuario no se muestran y "loading" se deriva sin efectos extra.
  const [loaded, setLoaded] = useState<{ userId: string; ids: Set<number> } | null>(null);
  const [pending, setPending] = useState<Set<number>>(EMPTY);
  const pendingRef = useRef(new Set<number>());

  const ids = userId && loaded?.userId === userId ? loaded.ids : EMPTY;
  const loading = userId !== null && loaded?.userId !== userId;
  const idsRef = useRef(ids);
  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchSavedIds()
      .then((list) => active && setLoaded({ userId, ids: new Set(list) }))
      .catch(() => active && setLoaded({ userId, ids: new Set() }));
    return () => {
      active = false;
    };
  }, [userId]);

  const toggle = useCallback(
    async (groupId: number) => {
      if (!userId || pendingRef.current.has(groupId)) return;
      const markPending = (on: boolean) => {
        if (on) pendingRef.current.add(groupId);
        else pendingRef.current.delete(groupId);
        setPending(new Set(pendingRef.current));
      };
      const had = idsRef.current.has(groupId);
      const apply = (add: boolean) =>
        setLoaded((prev) => {
          if (!prev || prev.userId !== userId) return prev;
          const next = new Set(prev.ids);
          if (add) next.add(groupId);
          else next.delete(groupId);
          return { userId, ids: next };
        });
      markPending(true);
      apply(!had);
      try {
        if (had) await removeSaved(groupId);
        else await addSaved(groupId);
      } catch {
        apply(had);
      } finally {
        markPending(false);
      }
    },
    [userId],
  );

  const value = useMemo(() => ({ ids, toggle, loading, pending }), [ids, toggle, loading, pending]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedValue {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved debe usarse dentro de SavedProvider");
  return ctx;
}
