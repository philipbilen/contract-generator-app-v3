import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Layout, Typography, Button, Spin, message } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import 'antd/dist/reset.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './App.css';
import AgreementForm from './AgreementForm';
import PdfViewer from './PdfViewer';
import ProjectHub from './ProjectHub';
import SettingsModal from './SettingsModal';
import { ConfigContext } from './ConfigContext';
import type { AppConfig, AppConfigUpdate, Project } from '../common/types';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

type GeneratedPdf = {
  path: string;
  refreshToken: number;
};

export default function App() {
  const [pdf, setPdf] = useState<GeneratedPdf | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const hasUserToggled = useRef(false);
  const [messageApi, contextHolder] = message.useMessage();

  const loadConfig = useCallback(async () => {
    if (!window.electron?.ipcRenderer?.invoke) {
      setLoadingConfig(false);
      return;
    }

    setLoadingConfig(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('config:get');
      if (result?.success && result.config) {
        setConfig(result.config as AppConfig);
      } else if (result?.message) {
        throw new Error(result.message);
      } else {
        throw new Error('Unable to load settings.');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      messageApi.error(`Failed to load settings: ${errorMessage}`);
    } finally {
      setLoadingConfig(false);
    }
  }, [messageApi]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updateConfig = useCallback(async (update: AppConfigUpdate) => {
    if (!window.electron?.ipcRenderer?.invoke) {
      throw new Error('Settings bridge is unavailable in this environment.');
    }

    const result = await window.electron.ipcRenderer.invoke(
      'config:update',
      update,
    );
    if (!result?.success || !result.config) {
      throw new Error(result?.message ?? 'Failed to update settings.');
    }
    setConfig(result.config as AppConfig);
  }, []);

  const handleSettingsSubmit = useCallback(
    async (update: AppConfigUpdate) => {
      setSavingSettings(true);
      try {
        await updateConfig(update);
        messageApi.success('Settings saved.');
        setSettingsOpen(false);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        messageApi.error(errorMessage);
      } finally {
        setSavingSettings(false);
      }
    },
    [messageApi, updateConfig],
  );

  const handleBrowseTemplates = useCallback(async () => {
    if (!window.electron?.ipcRenderer?.invoke) {
      messageApi.error('Cannot open a directory picker in this environment.');
      return null;
    }

    try {
      const result = await window.electron.ipcRenderer.invoke(
        'config:choose-templates',
      );
      if (result?.canceled) {
        if (result?.message) {
          messageApi.error(result.message);
        }
        return null;
      }
      return (result?.path as string) ?? null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      messageApi.error(`Failed to choose directory: ${errorMessage}`);
      return null;
    }
  }, [messageApi]);

  const contextValue = useMemo(
    () => ({
      config,
      refreshConfig: loadConfig,
      updateConfig,
    }),
    [config, loadConfig, updateConfig],
  );

  const onPdfGenerated = useCallback((path: string) => {
    setPdf({ path, refreshToken: Date.now() });
  }, []);

  const handleProjectSelect = useCallback((project: Project) => {
    setActiveProject(project);
    setPdf(null);
    if (!hasUserToggled.current) {
      setIsSidebarCollapsed(true);
    }
  }, []);

  const handleProjectDeleted = useCallback(
    (project: Project) => {
      if (activeProject?.path === project.path) {
        setActiveProject(null);
        setPdf(null);
      }
      messageApi.success(`Deleted project "${project.name}".`);
    },
    [activeProject, messageApi],
  );

  useEffect(() => {
    if (!activeProject) {
      // When returning to the hub, always expand the sidebar
      setIsSidebarCollapsed(false);
      // Reset the user's manual override
      hasUserToggled.current = false;
    }
  }, [activeProject]);

  const handleToggleSidebar = useCallback(() => {
    hasUserToggled.current = true;
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const renderWorkspace = () => {
    if (!activeProject) {
      return (
        <div className="workspace-empty">
          <Title level={3}>Choose a project to get started</Title>
          <Text>
            Open the project hub to create a new project or pick an existing
            one.
          </Text>
        </div>
      );
    }

    return (
      <div className="workspace">
        <section className="panel form-panel">
          <div className="panel-header">
            <h2>Agreement Details</h2>
            <p>
              Share label, release, and artist information to build the
              contract.
            </p>
          </div>
          <div className="panel-body panel-body--form">
            <AgreementForm
              onPdfGenerated={onPdfGenerated}
              activeProject={activeProject}
            />
          </div>
        </section>
        <section className="panel preview-panel">
          <div className="panel-header">
            <h2>Preview</h2>
            <p>Generate an agreement to see a live preview of the PDF.</p>
          </div>
          <div className="panel-body panel-body--preview">
            <PdfViewer file={pdf} />
          </div>
        </section>
      </div>
    );
  };

  const renderLayout = () => {
    const headerTitle = activeProject
      ? activeProject.name
      : 'Engeloop Contract Generator';
    const headerSubtitle = activeProject
      ? 'Populate the agreement details on the left and preview the PDF on the right.'
      : 'Open the project hub to create a new project or pick an existing one.';

    return (
      <Layout className="app-shell">
        <Sider
          width={460}
          collapsible
          collapsed={isSidebarCollapsed}
          collapsedWidth={0}
          trigger={null}
          className="project-sidebar"
        >
          <ProjectHub
            variant="sidebar"
            onProjectSelect={handleProjectSelect}
            onOpenSettings={() => setSettingsOpen(true)}
            onProjectDeleted={handleProjectDeleted}
            activeProject={activeProject}
          />
        </Sider>
        <Layout>
          <Header className="app-header">
            <div className="header-inner">
              <div className="header-left">
                <Title level={3}>{headerTitle}</Title>
                <Text className="header-subtitle">{headerSubtitle}</Text>
              </div>
              <div className="header-right">
                <Button
                  icon={<MenuOutlined />}
                  onClick={handleToggleSidebar}
                  style={{ marginRight: 8 }}
                >
                  {isSidebarCollapsed
                    ? 'Open Project Hub'
                    : 'Close Project Hub'}
                </Button>
                <Button onClick={() => setSettingsOpen(true)}>Settings</Button>
              </div>
            </div>
          </Header>
          <Content className="app-content">{renderWorkspace()}</Content>
        </Layout>
      </Layout>
    );
  };

  return (
    <ConfigContext.Provider value={contextValue}>
      {contextHolder}
      {loadingConfig && !config ? (
        <div className="app-loading">
          <Spin />
        </div>
      ) : (
        renderLayout()
      )}
      <SettingsModal
        open={settingsOpen}
        config={config}
        loading={savingSettings}
        onCancel={() => setSettingsOpen(false)}
        onSubmit={handleSettingsSubmit}
        onBrowseTemplates={handleBrowseTemplates}
      />
    </ConfigContext.Provider>
  );
}
