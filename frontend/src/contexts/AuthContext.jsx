import { createContext, useContext, useEffect, useReducer } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

const initial = { user: null, loading: true };

function reducer(state, action) {
  switch (action.type) {
    case "SET_USER": return { user: action.user, loading: false };
    case "CLEAR": return { user: null, loading: false };
    case "DONE_LOADING": return { ...state, loading: false };
    default: return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    const token = localStorage.getItem("ciq_token");
    if (!token) { dispatch({ type: "DONE_LOADING" }); return; }
    let cancelled = false;
    api.get("/auth/me")
      .then((r) => { if (!cancelled) dispatch({ type: "SET_USER", user: r.data }); })
      .catch(() => { localStorage.removeItem("ciq_token"); if (!cancelled) dispatch({ type: "CLEAR" }); });
    return () => { cancelled = true; };
  }, []);

  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    localStorage.setItem("ciq_token", r.data.token);
    dispatch({ type: "SET_USER", user: r.data.user });
    return r.data.user;
  };

  const register = async (name, email, password) => {
    const r = await api.post("/auth/register", { name, email, password });
    localStorage.setItem("ciq_token", r.data.token);
    dispatch({ type: "SET_USER", user: r.data.user });
    return r.data.user;
  };

  const logout = () => {
    localStorage.removeItem("ciq_token");
    dispatch({ type: "CLEAR" });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
