<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <nav class="border-b border-gray-700 px-6 py-4">
      <div class="flex items-center gap-6">
        <NuxtLink to="/" class="text-xl font-bold">leeg</NuxtLink>
        <NuxtLink to="/trainers" class="text-gray-400 hover:text-white">Trainers</NuxtLink>
        <NuxtLink to="/seasons" class="text-gray-400 hover:text-white">Seasons</NuxtLink>
      </div>
    </nav>
    <main class="p-6">
      <NuxtPage />
    </main>
  </div>
</template>
