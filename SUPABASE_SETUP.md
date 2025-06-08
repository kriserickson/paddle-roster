# Supabase Setup Guide

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign up"
3. Sign in with GitHub (recommended) or create an account
4. Click "New Project" 
5. Choose your organization (or create one)
6. Fill in project details:
   - Name: `paddleroster` or `pickleball-roster`
   - Database Password: Generate a strong password (save it!)
   - Region: Choose closest to your location
7. Click "Create new project"
8. Wait for the project to be created (2-3 minutes)

## Step 2: Get Project Credentials

1. In your Supabase dashboard, go to Settings > API
2. Copy the following values:
   - Project URL (under "Project URL")
   - anon public key (under "Project API keys" - the "anon" key)

## Step 3: Update Environment Variables

Replace the placeholder values in your `.env` file with the real credentials:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
```

## Step 4: Set Up Authentication

1. In Supabase dashboard, go to Authentication > Providers
2. Enable Email provider (should be enabled by default)
3. Go to Authentication > URL Configuration and add redirect URLs:
   - For development: `http://localhost:3000/auth/callback`
   - For development (password reset): `http://localhost:3000/auth/reset-password`
   - For production: `https://paddle-rocker.kriserickson.com/auth/callback`
   - For production (password reset): `https://paddle-rocker.kriserickson.com/auth/reset-password`
4. For Google OAuth (optional but recommended):
   - Enable Google provider
   - Add your site URL: `http://localhost:3000` for development
   - For production, add your actual domain
   - You'll need to set up Google OAuth credentials later

## Step 5: Create Database Schema

1. In Supabase dashboard, go to SQL Editor
2. Copy the contents of `supabase-schema.sql` and run it
3. This will create the players table and security policies

## Step 6: Test the Application

1. Restart your Nuxt dev server
2. The app should redirect to login page
3. Try creating an account with email/password
4. Once logged in, test adding players and generating games

## Troubleshooting

- If you get CORS errors, check the site URL in Authentication settings
- If authentication doesn't work, verify the environment variables are correct
- Check the browser console for any error messages
- Make sure Row Level Security policies are enabled on the players table
