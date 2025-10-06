# Gemini Project Instructions: Engeloop Contract Generator

## 1. Core Project Context

- **Objective**: This is an Electron/React desktop app for macOS that generates PDF agreements from LaTeX templates.
- **Tech Stack**:
    - **Framework**: Electron
    - **UI**: React with TypeScript
    - **Styling**: Plain CSS (`.css` files)
    - **Backend (Main Process)**: Node.js with TypeScript
    - **Boilerplate**: Based on `electron-react-boilerplate`. Adhere to its conventions for structure, build processes, and scripts.

## 2. My Core Mandates

- **Respect Architecture**: I MUST always respect the Electron `main`/`renderer` process separation.
    - `src/main`: Node.js environment. Handles file system, shell commands (`child_process`), and core business logic (like PDF generation).
    - `src/renderer`: React UI environment.
    - **Communication**: Use the existing IPC channel. I will check `src/main/preload.ts` for available channels and `src/renderer/preload.d.ts` for their TypeScript definitions before adding new ones.

- **Follow the Generation Flow**: The core workflow is: **UI Data -> IPC -> Sanitize Input -> Generate `.tex` config -> Compile with `latexmk` -> Return PDF path to UI**. I will not deviate from this pattern.

- **Prioritize Security**: Any data from the UI that will be used in a shell command or written to a file (especially the `.tex` config) MUST be sanitized. I will use the existing sanitization functions in `src/main/generator.ts`.

- **Align with the Action Plan**: Before implementing new features, I will refer to `ACTION_PLAN.md` to ensure my work aligns with the project roadmap.

- **Mimic Existing Code**: I will match the existing coding style, naming conventions, and architectural patterns.

## 3. Quick Facts & Commands

- **Development Server**: `npm start`
- **Testing**: `npm test` (using Jest and React Testing Library)
- **Packaging**: `npm run package`
- **Key Files**:
    - **Core Logic**: `src/main/generator.ts`
    - **UI Entrypoint**: `src/renderer/App.tsx`
    - **Main Process Entrypoint**: `src/main/main.ts`
    - **IPC Definitions**: `src/main/preload.ts` & `src/renderer/preload.d.ts`

## 4. Implemented Features (Project-Based Workflow)

- **Project Management**: The application now supports a project-based workflow.
    - **Project Hub**: A central UI (`src/renderer/ProjectHub.tsx`) for creating, listing, and renaming projects.
    - **Project Creation**: Users can create new projects, which generate dedicated folders (e.g., `~/Documents/Engeloop_Contracts/[Project Name]`).
    - **Project Renaming**: Projects can be renamed, which updates their corresponding folder names.
    - **Navigation**: A 'Back to Hub' button in the editor allows returning to the Project Hub.
- **Project-Specific Data Persistence**:
    - **Auto-Save/Load**: Form data is automatically saved to and loaded from `agreement_data.json` within the active project's folder.
    - **Manual Save**: A 'Save Project' button allows explicit saving of form data.
    - **PDF/LaTeX Output**: Generated `.tex` and `.pdf` files are now saved directly into the active project's folder.
- **IPC Channels**:
    - `projects:list`: Lists all existing projects.
    - `projects:create`: Creates a new project folder.
    - `projects:rename`: Renames a project folder.
    - `projects:save-agreement-data`: Saves form data to `agreement_data.json` in the project folder.
    - `projects:load-agreement-data`: Loads form data from `agreement_data.json` in the project folder.
- **Main Process Logic**: `src/main/main.ts` contains handlers for all project-related IPC calls, managing file system operations (folder creation, renaming, file read/write) and error handling.