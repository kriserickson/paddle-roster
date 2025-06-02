// Debug script to check Supabase configuration
import { createApp } from 'vue'

// Simple test to see environment variables
console.log('Environment Variables:')
console.log('SUPABASE_URL:', process.env.SUPABASE_URL)
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY)

// Check if the values are being passed through correctly
if (process.env.SUPABASE_URL) {
  console.log('✅ SUPABASE_URL is set')
} else {
  console.log('❌ SUPABASE_URL is NOT set')
}

if (process.env.SUPABASE_ANON_KEY) {
  console.log('✅ SUPABASE_ANON_KEY is set')
} else {
  console.log('❌ SUPABASE_ANON_KEY is NOT set')
}
