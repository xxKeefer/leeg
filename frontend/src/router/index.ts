import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import { useAuthStore } from "../stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView, meta: { requiresAuth: true } },
    { path: "/about", component: () => import("../views/AboutView.vue") },
    { path: "/login", component: () => import("../views/LoginView.vue"), meta: { guest: true } },
    { path: "/:pathMatch(.*)*", component: () => import("../views/NotFound.vue") },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return "/login";
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return "/";
  }
});

export default router;
