# Avo-Dashboard: Venue Management System

## 1. Short Description

Avo-Dashboard is a comprehensive web application designed for venue owners and staff to streamline their daily operations. It provides a centralized platform to manage menus, track customer orders, handle payments, organize staff and shifts, and monitor customer feedback. The system is intended for hospitality businesses like restaurants, cafes, and bars looking to digitize and optimize their management processes.

## 2. Tech Stack

The project is built with a modern and robust tech stack:

*   **Frontend:** React 18, TypeScript, Vite
*   **Styling:** Tailwind CSS with Radix UI for accessible components
*   **Routing:** React Router v6
*   **State Management:** TanStack Query for server state and React Context for global UI state
*   **Backend Services:** Firebase for authentication and real-time features (via Socket.io)
*   **Forms:** React Hook Form with Zod for validation

## 3. Key Features

*   **Venue Management:** Configure and update venue details and settings.
*   **Menu Engineering:** Create, update, and organize digital menus with categories, items, and modifiers.
*   **Order Management:** Real-time order tracking from placement to completion.
*   **Payment & POS:** Integration with payment systems and TPVs (Point of Sale).
*   **Staff & Shift Coordination:** Manage team members, assign roles (e.g., Waiter), and schedule shifts.
*   **Customer Feedback:** View and manage customer reviews to improve service quality.
*   **Admin Dashboard:** A powerful administrative panel for superusers to oversee multiple venues and system settings.

## 4. Project Structure

The codebase is organized following a feature-oriented architecture within the `src/` directory:

```
src/
├── components/    # Reusable UI components (Buttons, Inputs, etc.)
├── pages/         # Main application views for each feature (Menu, Orders, Venue)
├── context/       # Global state management (Authentication, Theme)
├── hooks/         # Custom React hooks for shared logic
├── services/      # API clients and functions for external services
├── routes/        # Application routing configuration
├── lib/           # Utility functions and shared libraries
└── types.ts       # Global TypeScript type definitions
```

## 5. Getting Started

Follow these instructions to set up the development environment locally.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or higher is recommended)
*   [npm](https://www.npmjs.com/) (comes with Node.js)

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd avo-dashboard
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project by copying the example file.
    ```bash
    cp .env.example .env
    ```
    Update the `.env` file with your local configuration and API keys (e.g., Firebase credentials).

## 6. Usage

To run the application in development mode with hot-reloading, use the following command:

```bash
npm run dev
```

This will start the Vite development server, typically available at `http://localhost:5173`.

## 7. Running Tests

This project does not currently have an automated test suite configured. To check for code quality, you can run the linter:

```bash
npm run lint
```

## 8. License

This project is currently unlicensed.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
