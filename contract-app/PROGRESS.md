# Project Progress Tracker

This document tracks the progress of the **Interactive Agreement Generator App** based on the phases outlined in the [ACTION_PLAN.md](ACTION_PLAN.md).

---

### Phase 1: Setup and Foundation (The Scaffolding)

- [x] **Install Prerequisites:** Ensure Node.js and npm are installed.
- [x] **Choose a Boilerplate:** Use `electron-react-boilerplate` to generate the initial project structure.
- [x] **Run the "Hello World" App:** Confirm the basic application window runs correctly.

---

### Phase 2: Architecting the Generation Engine

- [x] **Create `generator.js` Module:** In the Electron main process, create `src/main/generator.js`.
- [x] **Implement LaTeX Dependency Check:** On app startup, run `latexmk -v` using `child_process`. If it fails, display a user-friendly dialog explaining the requirement for a LaTeX distribution and link to an installer like MacTeX.
- [x] **Implement Input Sanitization:** Create a function that sanitizes string inputs to escape special LaTeX characters (e.g., `&` -> `\&`, `_` -> `\_`).
- [x] **Decouple Generation & Compilation:**
    - [x] **`generateConfig(data)` function:** Takes the sanitized UI data and writes the dynamic `agreement-config.tex` file.
    - [x] **`compilePdf(templatePath)` function:** Runs `latexmk` on the main `.tex` template.
- [x] **Implement Robust Error Handling:** Wrap file-writing and `child_process` calls in `try/catch` blocks.
- [x] **Set up IPC:** Create communication channels for the UI to call the generation/compilation functions.

---

### Phase 3: Building the Interactive UI & UX

- [x] **Component Layout:** Design the main window with panels for data entry and a live preview. (Now includes Project Hub)
- [x] **Create Input Forms:** Build React components for each section of the agreement. (Integrated with project workflow)
- [x] **Implement Accurate Live Preview:** (Integrated with project workflow)
    - [x] On form data change, trigger the `generateConfig` and `compilePdf` functions in the background.
    - [x] Use a library like `react-pdf` to display the newly generated PDF directly in the UI.
- [x] **Implement Data Persistence:**
    - [x] **Auto-Save:** Automatically save the current form state to Electron's `localStorage`. (Replaced with project-specific auto-save)
    - [x] **Save/Load Agreement:** Create "Save" and "Load" menu items for `.json` files. (Replaced with project-specific save/load)
- [x] **Implement Share Validation:** Add UI logic for instant feedback (e.g., ensuring artist shares sum to 100%).

---

### Phase 4: Project Management & Data Persistence

- [x] **Project Hub UI**: Implement a central hub for managing projects.
    - [x] Create New Project functionality with a modal for naming.
    - [x] List existing projects.
    - [x] Rename existing projects with a modal.
    - [x] "Back to Hub" navigation from the editor.
- [x] **Project-Specific Data Storage**: Each project gets its own folder.
    - [x] `agreement_data.json`: Auto-saves form data within the project folder.
    - [x] Generated `.tex` and `.pdf` files are saved directly into the project folder.
- [x] **IPC Channels**: New channels for `projects:list`, `projects:create`, `projects:rename`, `projects:save-agreement-data`, `projects:load-agreement-data`.
- [x] **Main Process Logic**: Implement file system operations for project creation, listing, renaming, and project-specific data saving/loading.

---

### Phase 5: Advanced Configuration Management

- [x] **Establish Configuration Hierarchy:**
    - [x] A **base `config.json`** will be bundled with the application (read-only).
    - [x] A **user `config.json`** will be stored in the directory from `app.getPath('userData')`.
    - [x] On startup, the app will merge the user config over the base config.
- [x] **Build the Settings UI:** Create a settings page in the React app.
- [x] **Develop the Settings Form:**
    - [x] Edit default agreement values.
    - [x] Specify the **absolute path** to their `contract-templates` directory.
- [x] **Implement Save Logic:** The settings UI will **only write to the user `config.json`**.

---

### Phase 6: Packaging and Finalizing

- [ ] **Integrate `electron-builder`:** Add and configure the packaging tool.
- [ ] **Configure the Build:** Set up the `electron-builder` configuration for a signed macOS `.app` file and `.dmg` installer.
- [ ] **Run the Build Command:** Execute the command to package the application.
- [ ] **Test the Final App:** Perform end-to-end testing on a clean machine.

---

### Phase 7: Future Considerations

- [ ] **Reorder Artist Cards**: Implement UI functionality to reorder artist cards, with the order reflecting in the generated output.
- [ ] **Portable LaTeX:** Investigate bundling a portable, stripped-down LaTeX distribution.
- [ ] **Flexible Signature Layout:** Re-architect the LaTeX template's signature section to automatically handle layout for any number of signatories.
