// src/main/generator.ts
import { exec, type ExecException } from 'child_process';
import { dialog } from 'electron'; // electron's dialog for user-facing messages
import fs from 'fs';
import path from 'path';
import log from 'electron-log';

// A function that returns a promise
export const checkLatex = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    exec('latexmk -v', (error) => {
      if (error) {
        dialog.showErrorBox(
          'LaTeX Dependency Missing',
          'To generate PDFs, you must have a LaTeX distribution like MacTeX installed on your system.\n\nPlease install it and restart the application.',
        );
        // After showing the error, reject the promise
        reject(new Error('latexmk command not found or not accessible.'));
        return;
      }
      resolve(); // Resolve if latexmk is found
    });
  });
};

// Function to escape special LaTeX characters
const sanitize = (value: unknown): string => {
  if (value === null || value === undefined) return '';

  const stringValue = String(value);
  const replacements: Record<string, string> = {
    '&': '\\&',
    '%': '\\%',
    $: '\\$',
    '#': '\\#',
    _: '\\_',
    '{': '\\{',
    '}': '\\}',
    '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}',
    '\\': '\\textbackslash{}',
  };

  return stringValue.replace(/[&%$#_{}~^\\]/g, (match) => replacements[match]);
};

// Decoupled function to write the .tex config file
// This is a simplified version; a full implementation would iterate through all data.
export const generateConfig = (data: any, outputPath: string): void => {
  const ensureArray = (value: unknown): any[] =>
    Array.isArray(value) ? value : [];
  const legacyArtists = ensureArray(data.artists);

  const derivedMainArtists = legacyArtists
    .filter((artist) =>
      typeof artist?.role === 'string'
        ? artist.role.toLowerCase().includes('main')
        : false,
    )
    .map((artist) => String(artist.stageName ?? '').trim())
    .filter((name) => name.length > 0);

  const derivedFeaturedArtists = legacyArtists
    .filter((artist) =>
      typeof artist?.role === 'string'
        ? artist.role.toLowerCase().includes('featured')
        : false,
    )
    .map((artist) => String(artist.stageName ?? '').trim())
    .filter((name) => name.length > 0);

  const derivedLicensors = legacyArtists.map((artist) => ({
    stageName: artist?.stageName ?? '',
    legalName: artist?.legalName ?? '',
    address: artist?.address ?? '',
    email: artist?.email ?? '',
  }));

  const derivedRoyaltyParties = legacyArtists.map((artist) => ({
    displayName: artist?.stageName ?? '',
    legalName: artist?.legalName ?? '',
    role: artist?.role ?? 'Artist',
    royaltyShare: artist?.royaltyShare,
    email: artist?.email ?? '',
  }));

  const resolvedMainArtists = (() => {
    const explicit = ensureArray(data.mainArtists)
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
    return explicit.length > 0 ? explicit : derivedMainArtists;
  })();

  const resolvedFeaturedArtists = (() => {
    const explicit = ensureArray(data.featuredArtists)
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
    return explicit.length > 0 ? explicit : derivedFeaturedArtists;
  })();

  const resolvedLicensors = (() => {
    const explicit = ensureArray(data.licensors);
    return explicit.length > 0 ? explicit : derivedLicensors;
  })();

  const resolvedRoyaltyParties = (() => {
    const explicit = ensureArray(data.royaltyParties);
    return explicit.length > 0 ? explicit : derivedRoyaltyParties;
  })();

  const commands: string[] = [];

  resolvedMainArtists.forEach((name) => {
    if (typeof name === 'string' && name.trim().length > 0) {
      commands.push(`\\addmainartist{${sanitize(name.trim())}}`);
    }
  });

  resolvedFeaturedArtists.forEach((name) => {
    if (typeof name === 'string' && name.trim().length > 0) {
      commands.push(`\\addfeaturedartist{${sanitize(name.trim())}}`);
    }
  });

  resolvedLicensors.forEach((licensor) => {
    const stageName = sanitize(licensor?.stageName ?? '');
    const legalName = sanitize(licensor?.legalName ?? '');
    const address = sanitize(licensor?.address ?? '');
    const email = sanitize(licensor?.email ?? '');
    if (stageName.length === 0 && legalName.length === 0) {
      return;
    }
    commands.push(
      `\\addlicensor{${stageName}}{${legalName}}{${address}}{${email}}`,
    );
  });

  resolvedRoyaltyParties.forEach((party) => {
    const displayName = sanitize(party?.displayName ?? '');
    const legalName = sanitize(party?.legalName ?? '');
    const role = sanitize(party?.role ?? 'Artist');
    const share = sanitize(party?.royaltyShare ?? '');
    const email = sanitize(party?.email ?? '');
    if (displayName.length === 0 && legalName.length === 0) {
      return;
    }
    commands.push(
      `\\addroyaltyparty{${displayName}}{${legalName}}{${role}}{${share}}{${email}}`,
    );
  });

  const configContent = `
\\newcommand{\\labelName}{${sanitize(data.labelName || '[Label Name]')}}
\\newcommand{\\labelLegalName}{${sanitize(data.labelLegalName || '[Label Legal Name]')}}
\\newcommand{\\labelAddress}{${sanitize(data.labelAddress || '[Label Address]')}}
\\newcommand{\\labelEmail}{${sanitize(data.labelEmail || '[Label Email]')}}
\\newcommand{\\labelSignatory}{${sanitize(data.labelSignatory || '[Authorised Signatory]')}}
\\newcommand{\\distroPartner}{${sanitize(data.distroPartner || '[Distribution Partner]')}}
\\newcommand{\\distroFee}{${sanitize(data.distroFee || '--')}}
\\newcommand{\\adaFee}{${sanitize(data.adaFee || '--')}}
\\newcommand{\\labelShare}{${sanitize(data.labelShare || '--')}}
\\newcommand{\\releaseTitle}{${sanitize(data.releaseTitle || '[Release Title]')}}
\\newcommand{\\releaseDate}{${sanitize(data.releaseDate || '[Release Date]')}}
\\newcommand{\\releaseUPC}{${sanitize(data.releaseUPC || '[UPC]')}}
\\newcommand{\\releaseISRC}{${sanitize(data.releaseISRC || '[ISRC]')}}

${commands.join('\n')}
  `;

  const configPath = path.join(outputPath, 'agreement-config.tex');

  try {
    fs.writeFileSync(configPath, configContent, 'utf8');
    log.info(`Successfully wrote config to ${configPath}`);
  } catch (error) {
    log.error('Failed to write config file:', error);
    throw new Error(
      `Failed to write configuration file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

// Decoupled function to run the PDF compilation
export const compilePdf = (
  templateDir: string,
  outputDir: string,
  pdfBaseName = 'master-agreement-template',
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Ensure the main template is in the templateDir
    const templateFile = path.join(
      templateDir,
      'master-agreement-template.tex',
    );
    if (!fs.existsSync(templateFile)) {
      reject(new Error(`LaTeX template file not found: ${templateFile}`));
      return;
    }

    const pdfFileName = 'master-agreement-template.pdf';
    const generatedPdfPath = path.join(outputDir, pdfFileName);
    const desiredBase = pdfBaseName.endsWith('.pdf')
      ? pdfBaseName.slice(0, -4)
      : pdfBaseName;
    const desiredPdfPath = path.join(outputDir, `${desiredBase}.pdf`);

    // latexmk will automatically look for agreement-config.tex in the same directory
    // or specified through -interaction=batchmode for non-interactive compilation
    const pathDelimiter = process.platform === 'win32' ? ';' : ':';
    const existingTexInputs = process.env.TEXINPUTS ?? '';
    const normalizedExisting =
      existingTexInputs.length === 0 ||
      existingTexInputs.endsWith(pathDelimiter)
        ? existingTexInputs
        : `${existingTexInputs}${pathDelimiter}`;
    const texInputs = `${outputDir}${pathDelimiter}${templateDir}${pathDelimiter}${normalizedExisting}`;

    const command = `latexmk -pdf -output-directory="${outputDir}" -interaction=batchmode -silent "${templateFile}"`;

    log.info(`Executing command: ${command}`);
    exec(
      command,
      { cwd: templateDir, env: { ...process.env, TEXINPUTS: texInputs } },
      (error, stdout, stderr) => {
        const finishSuccess = () => {
          if (!fs.existsSync(generatedPdfPath)) {
            reject(
              new Error(
                `PDF file was not created by LaTeX. Check logs for compilation errors.`,
              ),
            );
            return;
          }

          let finalPdfPath = generatedPdfPath;

          if (path.resolve(generatedPdfPath) !== path.resolve(desiredPdfPath)) {
            try {
              if (fs.existsSync(desiredPdfPath)) {
                fs.unlinkSync(desiredPdfPath);
              }
              fs.renameSync(generatedPdfPath, desiredPdfPath);
              finalPdfPath = desiredPdfPath;
            } catch (renameError: any) {
              reject(
                new Error(
                  `PDF was generated but could not be renamed: ${renameError instanceof Error ? renameError.message : String(renameError)}`,
                ),
              );
              return;
            }
          }

          log.info(`Successfully compiled PDF to ${finalPdfPath}`);
          resolve(finalPdfPath);
        };

        // Clean up auxiliary files generated by LaTeX
        exec(
          `latexmk -c -silent "${templateFile}"`,
          { cwd: templateDir, env: { ...process.env, TEXINPUTS: texInputs } },
          (cleanError) => {
            if (cleanError) {
              log.warn(
                `Error cleaning up LaTeX auxiliary files: ${cleanError.message}`,
              );
            }
          },
        );

        if (error) {
          const execError = error as ExecException;
          const { code: rawCode } = execError;
          let numericExitCode: number | undefined;
          if (typeof rawCode === 'string') {
            numericExitCode = Number(rawCode);
          } else if (typeof rawCode === 'number') {
            numericExitCode = rawCode;
          } else {
            numericExitCode = undefined;
          }

          if (numericExitCode === 12 && fs.existsSync(generatedPdfPath)) {
            log.warn(
              'latexmk exited with code 12 (warnings). PDF was produced; continuing.',
            );
            finishSuccess();
            return;
          }

          log.error(`latexmk error: ${error.message}`);
          log.error(`latexmk stdout: ${stdout}`);
          log.error(`latexmk stderr: ${stderr}`);
          reject(
            new Error(
              `PDF compilation failed. See console for details. Error: ${error.message}`,
            ),
          );
          return;
        }

        finishSuccess();
      },
    );
  });
};
