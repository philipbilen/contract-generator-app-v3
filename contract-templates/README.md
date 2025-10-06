# Contract Templates & Generation Script

This directory contains the core assets for generating Engeloop Master Licence Agreements.

The parent directory contains a `README.md` that explains the overall project structure, including the desktop application being developed in the `/contract-app` folder.

## Contents

*   **`master-agreement-template.tex`**: The master LaTeX template.
*   **`logo.png`**: The company logo.
*   **`config.sh`**: Default values for the interactive script.
*   **`generate-interactive-agreement.sh`**: The interactive command-line script for generating agreements.
*   **`/agreements`**: The default output directory for generated agreements.

## Usage

To generate a new agreement using the interactive script, navigate to this directory and run:

```bash
./generate-interactive-agreement.sh
```

The script will guide you through the process and save the output to the `/agreements` folder.
