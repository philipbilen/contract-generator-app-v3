import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { AppConfig } from '../common/types';
import App from '../renderer/App';

type InvokeResult = {
  success?: boolean;
  projects?: Array<{ name: string; path: string }>;
  data?: unknown;
  message?: string;
  canceled?: boolean;
  pdfPath?: string;
  config?: AppConfig;
};

jest.mock('react-pdf', () => ({
  Document: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Page: () => <div />,
}));

describe('App', () => {
  beforeEach(() => {
    const mockConfig = {
      agreementDefaults: {
        labelName: 'Mock Label',
        labelLegalName: 'Mock Legal',
        labelAddress: '123 Mock Street',
        labelEmail: 'mock@example.com',
        labelSignatory: 'Mock Signatory',
        distroPartner: 'Mock Partner',
        distroFee: 10,
        adaFee: 5,
        labelShare: 60,
      },
      templateDirectory: '',
    };

    (window as any).electron = {
      ipcRenderer: {
        sendMessage: jest.fn(),
        once: jest.fn(),
        on: jest.fn(() => () => {}),
        invoke: jest.fn(async (channel: string): Promise<InvokeResult> => {
          switch (channel) {
            case 'config:get':
              return { success: true, config: mockConfig };
            case 'config:update':
              return { success: true, config: mockConfig };
            case 'config:choose-templates':
              return { canceled: true };
            case 'projects:list':
              return { success: true, projects: [] };
            case 'projects:load-agreement-data':
              return { success: true, data: null };
            case 'projects:save-agreement-data':
              return { success: true };
            case 'generate-pdf':
              return {
                success: true,
                pdfPath: '/tmp/mock.pdf',
              } as InvokeResult;
            default:
              return { success: true };
          }
        }),
      },
    };
  });

  afterEach(() => {
    delete (window as any).electron;
  });

  it('should render the project hub', async () => {
    render(<App />);

    await waitFor(() =>
      expect(
        screen.getByText('Engeloop Contract Generator'),
      ).toBeInTheDocument(),
    );
  });
});
