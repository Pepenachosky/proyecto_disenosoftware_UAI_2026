import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./auth";
import { addSaved, fetchSavedIds, removeSaved } from "./data";

type SavedValue = { ids: Set<number>; toggle(groupId: number): Promise<void>; loading: boolean };

const SavedContext = createContext<SavedValue | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const idsRef = useRef(ids);
  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  useEffect(() => {
    if (!userId) {
      setIds(new Set());
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetchSavedIds()
      .then((list) => active && setIds(new Set(list)))
      .catch(() => active && setIds(new Set()))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId]);

  const toggle = useCallback(
    async (groupId: number) => {
      if (!userId) return;
      const had = idsRef.current.has(groupId);
      const apply = (add: boolean) =>
        setIds((prev) => {
          const next = new Set(prev);
          if (add) next.add(groupId);
          else next.delete(groupId);
          return next;
        });
      apply(!had);
      try {
        if (had) await removeSaved(groupId);
        else await addSaved(groupId);
      } catch {
        apply(had);
      }
    },
    [userId],
  );

  const value = useMemo(() => ({ ids, toggle, loading }), [ids, toggle, loading]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedValue {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved debe usarse dentro de SavedProvider");
  return ctx;
}
