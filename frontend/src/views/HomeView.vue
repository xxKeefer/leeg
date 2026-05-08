<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();

function handleLogout() {
  auth.logout();
  router.push("/login");
}
</script>

<template>
  <div class="max-w-md mx-auto mt-10 text-center">
    <h1 class="text-3xl font-bold mb-4">Welcome</h1>
    <p class="text-gray-600 mb-6">You are authenticated.</p>
    <button class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600" @click="handleLogout">
      Logout
    </button>
  </div>
</template>
