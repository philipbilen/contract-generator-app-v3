# Engeloop Master Agreement Generator

This project contains the tools and source code for generating Engeloop Master Licence Agreements. It features a modern desktop application that provides a user-friendly, project-based workflow for creating, managing, and generating PDF agreements from a master LaTeX template.

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js and npm**: Required for running the desktop application. You can download them from [nodejs.org](https://nodejs.org/).
*   **LaTeX**: A TeX distribution is required for compiling the `.tex` files into PDFs. [MacTeX](https://www.tug.org/mactex/) is recommended for macOS.

## Directory Structure

This workspace is organized into two main directories:

### 1. `contract-templates/`

This directory holds all the assets and data related to the agreements themselves. It serves as the "database" or "content" of the project.

*   `master-agreement-template.tex`: The master LaTeX template for the agreements.
*   `logo.png`: The company logo used in the template.
*   `generate-interactive-agreement.sh`: A legacy command-line script for generating agreements (superseded by the desktop app).

### 2. `contract-app/`

This directory contains the source code for the Electron-based desktop application that provides a graphical user interface (GUI) for generating the agreements.

*   `src/main/`: The Node.js backend (Main process) that handles file system operations, PDF generation, and other business logic.
*   `src/renderer/`: The frontend React application (Renderer process) that provides the user interface.
*   For a more detailed breakdown, see the [application's README](contract-app/README.md).

## Workflow

The primary method for generating agreements is through the desktop application, which uses a project-based approach.

1.  **Launch the App**: The user starts the **`contract-app`**.
2.  **Project Hub**: The app presents a hub where the user can create a new project or open an existing one.
3.  **Project Creation**: When a new project is created (e.g., "Client A Agreement"), the app creates a dedicated folder at `~/Documents/Engeloop_Contracts/Client A Agreement`.
4.  **Enter Data**: The user fills out the agreement details in the app's form. This data is automatically saved to `agreement_data.json` inside the project folder.
5.  **Generate PDF**: Upon completion, the user clicks "Generate". The app takes the data, combines it with the `master-agreement-template.tex`, and compiles a PDF.
6.  **Output**: The final PDF and its associated `.tex` source file are saved directly into the project's folder (e.g., `~/Documents/Engeloop_Contracts/Client A Agreement/`).

This project-based workflow ensures that all files related to a specific agreement are neatly organized in their own directory.

## Getting Started

1.  **Navigate to the app directory**:
    ```bash
    cd contract-app
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the application**:
    ```bash
    npm start
    ```
