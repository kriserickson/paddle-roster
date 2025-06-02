# Paddle Roster - Pickleball Player Matching System

A modern web application built with Nuxt.js that helps organize recreational pickleball leagues by intelligently matching players across multiple game rounds.

## Features

- **Smart Player Matching**: Balances skill levels, respects partner preferences, and ensures fair game distribution
- **Multi-Round Generation**: Supports 7-9 rounds with configurable rest periods
- **User Authentication**: Secure login with Supabase (Google OAuth + email/password)
- **Data Persistence**: Player data stored securely in Supabase PostgreSQL
- **Print-Friendly Schedules**: Generate professional printable game schedules
- **Demo Mode**: Try the app immediately without setting up authentication

## Quick Start

### Option 1: Demo Mode (Immediate)
The app runs in demo mode by default with localStorage persistence:

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` and start adding players immediately!

### Option 2: Full Setup with Supabase
For production use with authentication and cloud storage, follow the [Supabase Setup Guide](./SUPABASE_SETUP.md).

## Setup

Install dependencies:

```bash
npm install
```

### Environment Configuration

Copy the example environment file and configure as needed:

```bash
cp .env.example .env
```

**Environment Variables:**
- `SUPABASE_URL` - Your Supabase project URL (required for production mode)
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key (required for production mode)  
- `ENABLE_GOOGLE_AUTH` - Enable Google OAuth authentication (default: `false`)

**Note:** The app runs in demo mode when Supabase credentials are not provided.

## Available Scripts

### Development
```bash
npm run dev          # Start development server on http://localhost:3000
```

### Building & Production
```bash
npm run build        # Build the application for production
npm run generate     # Generate static site (SSG)
npm run preview      # Preview production build locally
```

### Code Quality
```bash
npm run lint         # Run ESLint to check code quality
npm run lint:fix     # Run ESLint and automatically fix issues
```

### Testing
```bash
npm run test         # Run unit tests with Vitest
npm run test:watch   # Run unit tests in watch mode
npm run test:ui      # Run unit tests with Vitest UI
npm run test:coverage # Run unit tests with coverage report
```

### End-to-End Testing
```bash
npm run test:e2e        # Run Playwright e2e tests
npm run test:e2e:ui     # Run e2e tests with Playwright UI
npm run test:e2e:debug  # Run e2e tests in debug mode
npm run test:e2e:headed # Run e2e tests in headed mode (visible browser)
npm run test:e2e:report # Show Playwright test report
```
