// Tiny data-fetch hook.
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function useApiResource(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;
    api.get(path).then(
      (r) => { if (!cancelled) setState({ data: r.data, error: null, loading: false }); },
      (e) => { if (!cancelled) setState({ data: null, error: e, loading: false }); },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return state;
}
