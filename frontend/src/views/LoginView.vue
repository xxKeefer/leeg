<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();

const isRegister = ref(false);
const email = ref("");
const password = ref("");
const loading = ref(false);

async function handleSubmit() {
  loading.value = true;
  auth.error = null;
  try {
    if (isRegister.value) {
      await auth.register(email.value, password.value);
    } else {
      await auth.login(email.value, password.value);
    }
    router.push("/");
  } catch {
    // error is set in the store
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="max-w-sm mx-auto mt-16">
    <h1 class="text-2xl font-bold mb-6 text-center">
      {{ isRegister ? "Create Account" : "Sign In" }}
    </h1>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label for="email" class="block text-sm font-medium mb-1">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium mb-1">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <p v-if="auth.error" class="text-red-600 text-sm">{{ auth.error }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {{ loading ? "..." : isRegister ? "Register" : "Login" }}
      </button>
    </form>

    <p class="mt-4 text-center text-sm text-gray-600">
      <button class="text-blue-500 hover:underline" @click="isRegister = !isRegister">
        {{ isRegister ? "Already have an account? Sign in" : "Need an account? Register" }}
      </button>
    </p>
  </div>
</template>
