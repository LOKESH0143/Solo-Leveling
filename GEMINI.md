# Project Overview

This project is a gamified personal development application inspired by the anime "Solo Leveling". It allows users to level up and improve their "stats" by completing real-life quests. The application is built with React, Vite, and TypeScript, and it uses Tailwind CSS for styling. The application state is stored locally in the browser.

## Main Technologies

*   **Frontend:** React, TypeScript, Vite
*   **Styling:** Tailwind CSS
*   **Animation:** `motion`
*   **Charts:** `recharts`
*   **Icons:** `lucide-react`
*   **Data Persistence:** `localStorage`

## Architecture

The application is a single-page application (SPA) built with React. The entire application logic is contained within the `src/App.tsx` file. The application state is managed using React's `useState` and `useEffect` hooks and is persisted to `localStorage`.

# Building and Running

## Prerequisites

*   Node.js

## Running the application

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Set the `GEMINI_API_KEY` in a `.env.local` file. You can copy the `.env.example` file to create it.
3.  Run the development server:
    ```bash
    npm run dev
    ```

## Building the application

To build the application for production, run the following command:

```bash
npm run build
```

The build artifacts will be stored in the `dist` directory.

## Linting

To lint the project, run the following command:

```bash
npm run lint
```

# Development Conventions

## Coding Style

The project uses TypeScript and follows standard React best practices. The code is well-structured and easy to read.

## Testing

There are no explicit tests in this project.

## Contribution Guidelines

There are no explicit contribution guidelines in this project.
