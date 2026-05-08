import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { apiFetch } from "../api/client";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(localStorage.getItem("token"));
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  function setToken(t: string) {
    token.value = t;
    localStorage.setItem("token", t);
  }

  function clearToken() {
    token.value = null;
    localStorage.removeItem("token");
  }

  async function login(email: string, password: string) {
    error.value = null;
    try {
      const res = await apiFetch<{ token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Login failed";
      throw e;
    }
  }

  async function register(email: string, password: string) {
    error.value = null;
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await login(email, password);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Registration failed";
      throw e;
    }
  }

  function logout() {
    clearToken();
  }

  return { token, error, isAuthenticated, login, register, logout };
});
