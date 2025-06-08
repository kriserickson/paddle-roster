<script setup lang="ts">
const supabase = useSupabaseClient();

// State
const loading = ref(false);
const error = ref('');
const success = ref(false);
const newPassword = ref('');
const confirmPassword = ref('');

// Check if we have a valid session from the reset link
const { data: session } = await supabase.auth.getSession();

// If no session, redirect to login
if (!session?.session) {
  await navigateTo('/auth/login');
}

async function updatePassword() {
  try {
    loading.value = true;
    error.value = '';

    // Validate passwords match
    if (newPassword.value !== confirmPassword.value) {
      error.value = 'Passwords do not match';
      return;
    }

    // Validate password length
    if (newPassword.value.length < 8) {
      error.value = 'Password must be at least 8 characters long';
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword.value
    });

    if (updateError) {
      error.value = updateError.message;
    } else {
      success.value = true;
      // Redirect to main app after successful password reset
      setTimeout(() => {
        navigateTo('/');
      }, 2000);
    }
  } catch (err) {
    error.value = 'An unexpected error occurred';
    console.error('Password update error:', err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    class="flex items-center justify-center bg-gradient-to-br from-paddle-teal to-blue-600 dark:from-gray-900 dark:to-gray-800 p-4 min-h-screen"
  >
    <div class="max-w-md w-full">
      <UCard class="p-8 shadow-2xl dark:bg-gray-900 dark:border-gray-700">
        <div class="text-center mb-8">
          <img src="/paddle-roster-128x128.webp" alt="Paddle Roster" class="w-16 h-16 mx-auto mb-4" />
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Reset Password</h1>
          <p class="text-gray-600 dark:text-gray-300 text-lg font-medium">
            {{ success ? 'Password Updated!' : 'Create a new password' }}
          </p>
          <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {{ success ? 'You will be redirected to the app shortly' : 'Choose a strong password (8+ characters)' }}
          </p>
        </div>

        <div v-if="!success" class="space-y-6">
          <!-- Password Reset Form -->
          <form class="space-y-6" @submit.prevent="updatePassword">
            <div class="space-y-6">
              <div class="mb-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300"> New Password </label>
                <UInput
                  v-model="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  required
                  size="lg"
                  class="w-full mb-2 dark:bg-gray-900 dark:text-white"
                  :ui="{ base: 'h-12' }"
                />
              </div>

              <div class="mb-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Confirm Password </label>
                <UInput
                  v-model="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  required
                  size="lg"
                  class="w-full dark:bg-gray-900 dark:text-white"
                  :ui="{ base: 'h-12' }"
                />
              </div>
            </div>

            <UButton
              type="submit"
              :loading="loading"
              size="lg"
              class="w-full h-12 btn-primary text-base font-medium dark:bg-paddle-teal-dark dark:text-white"
            >
              Update Password
            </UButton>
          </form>

          <!-- Error Message -->
          <UAlert v-if="error" :title="error" color="error" variant="soft" class="text-sm" />

          <!-- Back to Login Link -->
          <div class="text-center">
            <NuxtLink
              to="/auth/login"
              class="text-sm text-paddle-teal dark:text-paddle-teal-light hover:text-paddle-teal-dark dark:hover:text-paddle-teal underline"
            >
              Back to Sign In
            </NuxtLink>
          </div>
        </div>

        <div v-else class="space-y-6">
          <!-- Success Message -->
          <UAlert title="Password updated successfully!" color="success" variant="soft" class="text-sm" />

          <div class="text-center">
            <Icon name="mdi:check-circle" class="text-4xl text-green-500 mb-4" />
            <p class="text-gray-600 dark:text-gray-300">Redirecting you to the app...</p>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
