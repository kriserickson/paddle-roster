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

// Form state
const isSignUp = ref(false);
const email = ref('');
const password = ref('');

function handleEmailAuth() {
  if (isSignUp.value) {
    signUpWithEmail(email.value, password.value);
  } else {
    signInWithEmail(email.value, password.value);
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-paddle-teal to-blue-600 p-4">
    <div class="max-w-md w-full">
      <UCard class="p-8 shadow-2xl">
        <div class="text-center mb-8">
          <img src="/paddle-roster-128x128.webp" alt="Paddle Roster" class="w-16 h-16 mx-auto mb-4" >
          <h1 class="text-3xl font-bold text-gray-900 mb-2">Paddle Roster</h1>
            <!-- Clear Mode Indicator -->
          <div class="mb-6">
            <div class="inline-flex rounded-lg border-2 border-gray-500 p-1 bg-gray-300">
              <button
                @click="isSignUp = false"
                :class="[
                  'px-6 py-3 text-base font-semibold rounded-md transition-all duration-200',
                  !isSignUp 
                    ? 'bg-white text-paddle-teal shadow-lg border-2 border-paddle-teal scale-105 transform' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                ]"
              >
                Sign In
              </button>
              <button
                @click="isSignUp = true"
                :class="[
                  'px-6 py-3 text-base font-semibold rounded-md transition-all duration-200',
                  isSignUp 
                    ? 'bg-white text-paddle-teal shadow-lg border-2 border-paddle-teal scale-105 transform' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                ]"
              >
                Sign Up
              </button>
            </div>
          </div>
          
          <p class="text-gray-600 text-lg font-medium">
            {{ isSignUp ? 'Create your new account' : 'Welcome back!' }}
          </p>
          <p class="text-gray-500 text-sm mt-1">
            {{ isSignUp ? 'Join the pickleball community' : 'Sign in to continue to your dashboard' }}
          </p>
        </div>        <div class="space-y-8">
          <!-- Google Auth (conditional) -->
          <template v-if="enableGoogleAuth">
            <UButton 
              @click="signInWithGoogle"
              :loading="loading"
              variant="outline"
              size="lg"
              class="w-full h-12"
              icon="i-logos-google-icon"
            >
              {{ isSignUp ? 'Sign up with Google' : 'Continue with Google' }}
            </UButton>

            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300" />
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-4 bg-white text-gray-500">Or {{ isSignUp ? 'sign up' : 'continue' }} with email</span>
              </div>
            </div>
          </template>

          <!-- Email Auth Form -->
          <form @submit.prevent="handleEmailAuth" class="space-y-6">
            <div class="space-y-6">
              <UFormGroup 
                label="Email address"
                :description="isSignUp ? 'We\'ll send you a confirmation email' : ''"
                class="mb-2"
              >
                <UInput 
                  v-model="email"
                  type="email"
                  placeholder="Enter your email"
                  required
                  size="lg"
                  class="w-full mb-2"
                  :ui="{ base: 'h-12' }"
                />
              </UFormGroup>

              <UFormGroup 
                label="Password"              
                :description="isSignUp ? 'Choose a strong password (8+ characters)' : ''"
              >
                <UInput 
                  v-model="password"
                  type="password"
                  :placeholder="isSignUp ? 'Create a password' : 'Enter your password'"
                  required
                  size="lg"
                  class="w-full"
                  :ui="{ base: 'h-12' }"
                />
              </UFormGroup>
            </div>

            <UButton 
              type="submit"
              :loading="loading"
              size="lg"
              class="w-full h-12 btn-primary text-base font-medium"
            >
              {{ isSignUp ? 'Create Account' : 'Sign In' }}
            </UButton>
          </form>          <!-- Error/Success Message -->          
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
