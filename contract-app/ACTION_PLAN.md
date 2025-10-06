## Current Status

**Phase 1 & 2 are complete.** The project is set up, and the core generation engine is built. The next steps will focus on building the user interface as outlined in Phase 3.

---

### **Project: Interactive Agreement Generator App**

The goal is to create a robust, standalone macOS application that provides a graphical user interface for generating PDFs from LaTeX templates.

**Technology Stack:**

- **Application Framework:** Electron
- **User Interface (UI):** React
- **UI Library:** Ant Design or Material-UI for a polished look.
- **PDF Preview:** `react-pdf` or a similar library for accurate live previews.
- **Backend Logic:** Node.js (built into Electron)
- **External Dependencies:** A locally installed LaTeX distribution (e.g., MacTeX) is required. The app will check for this dependency on launch.

---

### **Phase 1: Setup and Foundation (The Scaffolding)**

- **Objective:** Create a basic, runnable Electron application with a React UI.
- **Action Items:**
  1.  **Install Prerequisites:** Ensure Node.js and npm are installed.
  2.  **Choose a Boilerplate:** Use `electron-react-boilerplate` to generate the initial project structure.
  3.  **Run the "Hello World" App:** Confirm the basic application window runs correctly.

### **Phase 2: Architecting the Generation Engine**

- **Objective:** Create a robust, decoupled, and safe Node.js module for handling the LaTeX generation process.
- **Action Items:**
  1.  **Create `generator.js` Module:** In the Electron main process, create `src/main/generator.js`.
  2.  **Implement LaTeX Dependency Check:** On app startup, run `latexmk -v` using `child_process`. If it fails, display a user-friendly dialog explaining the requirement for a LaTeX distribution and link to an installer like MacTeX.
  3.  **Implement Input Sanitization:** Create a function that sanitizes string inputs to escape special LaTeX characters (e.g., `&` -> `\&`, `_` -> `\_`). This is critical to prevent compilation errors.
  4.  **Decouple Generation & Compilation:**
      - **`generateConfig(data)` function:** Takes the sanitized UI data and writes the dynamic `agreement-config.tex` file. This isolates data-writing logic.
      - **`compilePdf(templatePath)` function:** Runs `latexmk` on the main `.tex` template. This isolates the compilation process.
  5.  **Implement Robust Error Handling:** Wrap file-writing and `child_process` calls in `try/catch` blocks to provide specific error feedback to the user (e.g., "Failed to save configuration" vs. "PDF compilation failed").
  6.  **Set up IPC:** Create communication channels for the UI to call the generation/compilation functions and receive detailed success or failure messages.

### **Phase 3: Building the Interactive UI & UX**

- **Objective:** Create a user-friendly and resilient interface for data entry and preview.
- **Action Items:**
  1.  **Component Layout:** Design the main window with panels for data entry and a live preview.
  2.  **Create Input Forms:** Build React components for each section of the agreement.
  3.  **Implement Accurate Live Preview:**
      - On form data change, trigger the `generateConfig` and `compilePdf` functions in the background.
      - Use a library like `react-pdf` to display the newly generated PDF directly in the UI. This ensures a 100% accurate preview.
  4.  **Implement Data Persistence:**
      - **Auto-Save:** Automatically save the current form state to Electron's `localStorage` as the user types. Restore this data when the app re-opens to prevent data loss.
      - **Save/Load Agreement:** Create "Save" and "Load" menu items that allow users to save the complete form data to a `.json` file and load it back into the app later.
  5.  **Implement Share Validation:** Add UI logic for instant feedback (e.g., ensuring artist shares sum to 100%).

### **Phase 4: Advanced Configuration Management**

- **Objective:** Implement a flexible and persistent configuration system.
- **Action Items:**
  1.  **Establish Configuration Hierarchy:**
      - A **base `config.json`** will be bundled with the application (read-only).
      - A **user `config.json`** will be stored in the directory from `app.getPath('userData')`.
      - On startup, the app will merge the user config over the base config to get the final settings.
  2.  **Build the Settings UI:** Create a settings page in the React app.
  3.  **Develop the Settings Form:** Build a form that allows users to:
      - Edit default agreement values (e.g., label name).
      - Specify the **absolute path** to their `contract-templates` directory.
  4.  **Implement Save Logic:** The settings UI will **only write to the user `config.json`**, ensuring user preferences are preserved across app updates.

### **Phase 5: Packaging and Finalizing**

- **Objective:** Bundle the application into a distributable macOS app.
- **Action Items:**
  1.  **Integrate `electron-builder`:** Add and configure the packaging tool.
  2.  **Configure the Build:** Set up the `electron-builder` configuration for a signed macOS `.app` file and `.dmg` installer.
  3.  **Run the Build Command:** Execute the command to package the application.
  4.  **Test the Final App:** Perform end-to-end testing on a clean machine to verify dependency checks, pathing, and configuration work as expected.

### **Phase 6: Future Considerations**

- **Objective:** Document potential long-term improvements.
- **Items:**
  - **Portable LaTeX:** Investigate bundling a portable, stripped-down LaTeX distribution to remove the main external dependency.
  - **Flexible Signature Layout:** Re-architect the LaTeX template's signature section to use an environment that automatically handles layout for any number of signatories, avoiding blank spaces.
  - **plan a future “Export snapshot” if versioning ever matters.**
