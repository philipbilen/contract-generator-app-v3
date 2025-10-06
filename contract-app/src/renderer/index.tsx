import { createRoot } from 'react-dom/client';
import { pdfjs } from 'react-pdf';
import App from './App';

// Configure the PDF.js worker.
// The worker is copied to the `static` folder by webpack.
pdfjs.GlobalWorkerOptions.workerSrc = `/static/pdf.worker.min.mjs`;

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<App />);

// calling IPC exposed from preload script
window.electron?.ipcRenderer.once('ipc-example', (arg) => {
  // eslint-disable-next-line no-console
  console.log(arg);
});
window.electron?.ipcRenderer.sendMessage('ipc-example', ['ping']);
