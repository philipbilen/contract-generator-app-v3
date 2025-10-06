# Engeloop Contract Generator App

This is an Electron-based desktop application for generating Engeloop Master Licence Agreements. It provides a user-friendly graphical interface for filling out agreement details and generating a final PDF.

## Features

### Project-Based Workflow

The application now operates on a project-based system, allowing you to organize your agreements efficiently:

*   **Project Hub**: Upon launching the app, you'll be greeted by a Project Hub where you can:
    *   **Create New Projects**: Give your agreement a name, and the app will set up a dedicated folder for it.
    *   **Open Existing Projects**: Select from a list of your previously created projects.
    *   **Rename Projects**: Easily change the name of any existing project.
*   **Dedicated Project Folders**: Each project has its own folder (e.g., in `~/Documents/Engeloop_Contracts/`), where all related files are stored, including:
    *   `agreement_data.json`: Automatically saves your form field inputs as you type.
    *   Generated `.tex` files.
    *   Final PDF outputs.
*   **Auto-Save & Load**: Your form data is automatically saved as you work within a project and loaded seamlessly when you open it again.
*   **Back to Hub Navigation**: From within an active project, you can easily navigate back to the Project Hub using the 'Back to Hub' button in the top right.

This application is part of a larger monorepo. For more information about the overall project structure and the relationship between the app and the contract templates, please see the [main project README](../../README.md).

## Tech Stack

*   **Framework**: [Electron](https://www.electronjs.org/)
*   **UI**: [React](https://reactjs.org/) with [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: Plain CSS (`.css` files)
*   **Backend (Main Process)**: [Node.js](https://nodejs.org/) with TypeScript
*   **Boilerplate**: [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate)

## Architecture

The application follows the standard Electron architecture, which separates the application into two main processes:

*   **Main Process** (`src/main`): This is the Node.js backend environment. It has access to all Node.js APIs, including the file system (`fs`) and child processes (`child_process`). It is responsible for all "heavy lifting," such as creating windows, handling file I/O, and executing the LaTeX compilation process.
*   **Renderer Process** (`src/renderer`): This is the frontend React application that runs in a Chromium browser window. It is responsible for the user interface and user interactions. It does **not** have direct access to Node.js APIs for security reasons.

Communication between these two processes is handled securely via a **Preload Script** (`src/main/preload.ts`), which exposes specific functions from the Main process to the Renderer process through an `electron.contextBridge`.

## Development and Scripts

This project was bootstrapped with [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate).

### Starting Development

Start the app in the `dev` environment. This will run the main process and the renderer process in watch mode for hot-reloading.

```bash
npm start
```

### Running Tests

Execute the unit and component tests using Jest and React Testing Library.

```bash
npm test
```

### Linting

Check the code for style and quality issues using ESLint.

```bash
npm run lint
```

### Packaging for Production

To package the app for your local platform:

```bash
npm run package
```

### Further Documentation

For more details on the available scripts and the project structure, you can refer to the [Electron React Boilerplate documentation](https://electron-react-boilerplate.js.org/docs/installation).