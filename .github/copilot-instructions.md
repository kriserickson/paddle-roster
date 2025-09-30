# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview

This is a **Pickleball Player Matching System** built with Nuxt.js and TypeScript. The application helps organize recreational
pickleball leagues by intelligently matching players across multiple game rounds.

## Key Features

- **Player Management**: CRUD operations with local storage persistence
- **Smart Matching Algorithm**: Balances skill levels, respects partner preferences, and ensures fair game distribution
- **Multi-Round Generation**: Supports 7-9 rounds with configurable rest periods
- **Print-Friendly Schedules**: Generate printable game schedules with customizable headers

## Technical Stack

- **Framework**: Nuxt.js 3 with TypeScript
- **UI Library**: @nuxt/ui (Tailwind CSS + headless components)
- **Icons**: @nuxt/icon with Iconify
- **Storage**: Local Storage for player data persistence
- **Testing**: @nuxt/test-utils for unit and integration tests

## Code Style Guidelines

- Use TypeScript interfaces for all data structures, don't use `any` type
- Always end each line with a semicolon
- Follow Vue 3 Composition API patterns for component logic
- Implement reactive state management with Vue 3 Composition API
- Follow Nuxt.js best practices for SSR/SSG compatibility
- Write comprehensive JSDoc comments for complex algorithms
- Use Tailwind CSS classes with @nuxt/ui components for styling
- Always use `async/await` for asynchronous operations
- Always use braces and semicolons for clarity even with short control statements
- Use descriptive variable and function names
- Ue functions for methods and and arrow functions for computed properties e.g. in eslint ( 'func-style': ['error', 'declaration', { 'allowArrowFunctions': false }])
- Use template syntax for declarative rendering.
- In Vue files have the script first, then the template, and finally the style section.
- The functions should use function declarations rather than constants with lambdas.

## Data Models

Key interfaces to maintain:

- `Player`: name, skillLevel (1-5, decimals allowed), partner reference
- `Game`: court assignment, player assignments, round number
- `MatchingOptions`: skill balancing, partner preferences, rest distribution

## Algorithm Requirements

The matching algorithm should:

1. Avoid extreme skill mismatches between teams
2. Respect partner preferences when enabled
3. Distribute rest periods equally (1-4 players per round)
4. Minimize repeated pairings across rounds
5. Balance court utilization across all rounds
