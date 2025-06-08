<script setup lang="ts">
const supabase = useSupabaseClient();
const user = useSupabaseUser();
const config = useRuntimeConfig();

// Check if Google auth is enabled
const enableGoogleAuth = config.public.enableGoogleAuth;

// Redirect if already logged in
watchEffect(() => {
  if (user.value) {
    navigateTo('/');
  }
});

// Auth state
const loading = ref(false);
const error = ref('');

// Auth methods
async function signInWithGoogle() {
  try {
    loading.value = true;
    error.value = '';

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (authError) {
      error.value = authError.message;
    }
  } catch (err) {
    error.value = 'An unexpected error occurred';
    console.error('Auth error:', err);
  } finally {
    loading.value = false;
  }
}

async function signInWithEmail(email: string, password: string) {
  try {
    loading.value = true;
    error.value = '';

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      error.value = authError.message;
    } else {
      await navigateTo('/');
    }
  } catch (err) {
    error.value = 'An unexpected error occurred';
    console.error('Auth error:', err);
  } finally {
    loading.value = false;
  }
}

async function signUpWithEmail(email: string, password: string) {
  try {
    loading.value = true;
    error.value = '';

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (authError) {
      error.value = authError.message;
    } else {
      // Show success message
      error.value = 'Check your email for a confirmation link!';
    }
  } catch (err) {
    error.value = 'An unexpected error occurred';
    console.error('Auth error:', err);
  } finally {
    loading.value = false;
  }
}

async function resetPassword(email: string) {
  try {
    loading.value = true;
    error.value = '';

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    });

    if (authError) {
      error.value = authError.message;
    } else {
      error.value = 'Password reset email sent! Check your inbox for instructions.';
    }
  } catch (err) {
    error.value = 'An unexpected error occurred';
    console.error('Password reset error:', err);
  } finally {
    loading.value = false;
  }
}

// Form state
const isSignUp = ref(false);
const showPasswordReset = ref(false);
const email = ref('');
const password = ref('');

function handleEmailAuth() {
  if (isSignUp.value) {
    signUpWithEmail(email.value, password.value);
  } else {
    signInWithEmail(email.value, password.value);
  }
}

function handlePasswordReset() {
  resetPassword(email.value);
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
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Paddle Roster</h1>
          <!-- Clear Mode Indicator -->
          <div class="mb-6">
            <div
              class="inline-flex rounded-lg border-2 border-gray-500 dark:border-gray-600 p-1 bg-gray-300 dark:bg-gray-800"
            >
              <button
                :class="[
                  'px-6 py-3 text-base font-semibold rounded-md transition-all duration-200',
                  !isSignUp && !showPasswordReset
                    ? 'bg-white dark:bg-gray-900 text-paddle-teal dark:text-paddle-teal-light shadow-lg border-2 border-paddle-teal dark:border-paddle-teal-light scale-105 transform'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                ]"
                @click="
                  isSignUp = false;
                  showPasswordReset = false;
                "
              >
                Sign In
              </button>
              <button
                :class="[
                  'px-6 py-3 text-base font-semibold rounded-md transition-all duration-200',
                  isSignUp && !showPasswordReset
                    ? 'bg-white dark:bg-gray-900 text-paddle-teal dark:text-paddle-teal-light shadow-lg border-2 border-paddle-teal dark:border-paddle-teal-light scale-105 transform'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                ]"
                @click="
                  isSignUp = true;
                  showPasswordReset = false;
                "
              >
                Sign Up
              </button>
            </div>
          </div>

          <p class="text-gray-600 dark:text-gray-300 text-lg font-medium">
            {{ showPasswordReset ? 'Reset your password' : isSignUp ? 'Create your new account' : 'Welcome back!' }}
          </p>
          <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {{
              showPasswordReset
                ? 'Enter your email to receive reset instructions'
                : isSignUp
                  ? 'Join the pickleball community'
                  : 'Sign in to continue to your dashboard'
            }}
          </p>
        </div>
        <div class="space-y-8">
          <!-- Google Auth (conditional) -->
          <template v-if="enableGoogleAuth">
            <UButton
              :loading="loading"
              variant="outline"
              size="lg"
              class="w-full h-12 dark:bg-gray-900 dark:text-white dark:border-gray-700"
              icon="i-logos-google-icon"
              @click="signInWithGoogle"
            >
              {{ isSignUp ? 'Sign up with Google' : 'Continue with Google' }}
            </UButton>

            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300 dark:border-gray-700" />
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-4 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400"
                  >Or {{ isSignUp ? 'sign up' : 'continue' }} with email</span
                >
              </div>
            </div>
          </template>

          <!-- Email Auth Form -->
          <form v-if="!showPasswordReset" class="space-y-6" @submit.prevent="handleEmailAuth">
            <div class="space-y-6">
              <div class="mb-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Email address </label>
                <p v-if="isSignUp" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  We'll send you a confirmation email
                </p>

                <UInput
                  v-model="email"
                  type="email"
                  placeholder="Enter your email"
                  required
                  size="lg"
                  class="w-full mb-2 dark:bg-gray-900 dark:text-white"
                  :ui="{ base: 'h-12' }"
                />
              </div>

              <div class="mb-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Password </label>
                <p v-if="isSignUp" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Choose a strong password (8+ characters)
                </p>
                <UInput
                  v-model="password"
                  type="password"
                  :placeholder="isSignUp ? 'Create a password' : 'Enter your password'"
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
              {{ isSignUp ? 'Create Account' : 'Sign In' }}
            </UButton>

            <!-- Forgot Password Link (only show for sign in) -->
            <div v-if="!isSignUp" class="text-center">
              <button
                type="button"
                class="text-sm text-paddle-teal dark:text-paddle-teal-light hover:text-paddle-teal-dark dark:hover:text-paddle-teal underline"
                @click="showPasswordReset = true"
              >
                Forgot your password?
              </button>
            </div>
          </form>

          <!-- Password Reset Form -->
          <form v-else class="space-y-6" @submit.prevent="handlePasswordReset">
            <div class="space-y-6">
              <div class="mb-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Email address </label>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  We'll send you a link to reset your password
                </p>

                <UInput
                  v-model="email"
                  type="email"
                  placeholder="Enter your email"
                  required
                  size="lg"
                  class="w-full mb-2 dark:bg-gray-900 dark:text-white"
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
              Send Reset Email
            </UButton>

            <!-- Back to Sign In Link -->
            <div class="text-center">
              <button
                type="button"
                class="text-sm text-paddle-teal dark:text-paddle-teal-light hover:text-paddle-teal-dark dark:hover:text-paddle-teal underline"
                @click="showPasswordReset = false"
              >
                Back to Sign In
              </button>
            </div>
          </form>
          <!-- Error/Success Message -->
          <UAlert
            v-if="error"
            :title="error"
            :color="error.includes('Check your email') ? 'success' : 'error'"
            variant="soft"
            class="text-sm"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
