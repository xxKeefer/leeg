<script setup lang="ts">
import { useAuthStore } from "./stores/auth";

const auth = useAuthStore();
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <nav class="bg-white shadow p-4 flex gap-4 items-center">
      <RouterLink to="/" class="font-semibold hover:text-blue-600">Home</RouterLink>
      <RouterLink to="/about" class="hover:text-blue-600">About</RouterLink>
      <template v-if="auth.isAuthenticated">
        <RouterLink to="/leagues/create" class="hover:text-blue-600">New League</RouterLink>
      </template>
      <template v-if="!auth.isAuthenticated">
        <RouterLink to="/login" class="ml-auto hover:text-blue-600">Login</RouterLink>
      </template>
    </nav>
    <main class="p-6">
      <RouterView />
    </main>
  </div>
</template>
