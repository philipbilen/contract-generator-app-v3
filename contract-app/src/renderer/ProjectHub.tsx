import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  Input,
  Dropdown,
  Button,
  MenuProps,
  Empty,
  Typography,
} from 'antd';
import { MoreOutlined, SearchOutlined } from '@ant-design/icons';
import type { Project } from '../common/types';
import './ProjectHub.css';

const { Text } = Typography;

type ProjectHubProps = {
  onProjectSelect: (project: Project) => void;
  onOpenSettings: () => void;
  onProjectDeleted: (project: Project) => void;
  activeProject: Project | null;
  variant: 'full' | 'sidebar';
};

export default function ProjectHub({
  onProjectSelect,
  onOpenSettings,
  onProjectDeleted,
  activeProject,
  variant,
}: ProjectHubProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // State for the "Create Project" modal
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // State for the "Rename Project" modal
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameNewName, setRenameNewName] = useState('');

  // State for the "Duplicate Project" modal
  const [isDuplicateModalVisible, setIsDuplicateModalVisible] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<Project | null>(null);
  const [duplicateNewName, setDuplicateNewName] = useState('');

  const fetchProjects = useCallback(async () => {
    try {
      setError(null);
      const result = await window.electron.ipcRenderer.invoke('projects:list');
      if (result.success) {
        setProjects(result.projects);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // --- Create Project Handlers ---
  const handleShowCreateModal = () => {
    setIsCreateModalVisible(true);
  };

  const handleCancelCreateModal = () => {
    setIsCreateModalVisible(false);
    setNewProjectName('');
  };

  const handleCreateProject = async () => {
    if (newProjectName && newProjectName.trim().length > 0) {
      try {
        setError(null);
        const trimmedName = newProjectName.trim();
        const result = await window.electron.ipcRenderer.invoke(
          'projects:create',
          trimmedName,
        );
        if (result.success) {
          await fetchProjects();
          onProjectSelect(result.project);
        } else {
          setError(result.message);
        }
      } catch (err: any) {
        setError(err.message);
      }
    }
    setNewProjectName('');
    setIsCreateModalVisible(false);
  };

  // --- Rename Project Handlers ---
  const handleShowRenameModal = (project: Project) => {
    setRenameTarget(project);
    setRenameNewName(project.name);
    setIsRenameModalVisible(true);
  };

  const handleCancelRenameModal = () => {
    setIsRenameModalVisible(false);
    setRenameNewName('');
    setRenameTarget(null);
  };

  const handleRenameProject = async () => {
    if (!renameTarget || !renameNewName || renameNewName.trim().length === 0) {
      handleCancelRenameModal();
      return;
    }

    const targetProject = renameTarget;
    const trimmedName = renameNewName.trim();

    try {
      setError(null);
      const result = await window.electron.ipcRenderer.invoke(
        'projects:rename',
        {
          currentPath: targetProject.path,
          newName: trimmedName,
        },
      );

      if (result.success) {
        await fetchProjects();
        if (activeProject?.path === targetProject.path) {
          onProjectSelect(result.project);
        }
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      handleCancelRenameModal();
    }
  };

  const handleShowDuplicateModal = (project: Project) => {
    setDuplicateSource(project);
    setDuplicateNewName(`${project.name} Copy`);
    setIsDuplicateModalVisible(true);
  };

  const handleCancelDuplicateModal = () => {
    setIsDuplicateModalVisible(false);
    setDuplicateSource(null);
    setDuplicateNewName('');
  };

  const handleDuplicateProject = async () => {
    if (
      !duplicateSource ||
      !duplicateNewName ||
      duplicateNewName.trim().length === 0
    ) {
      handleCancelDuplicateModal();
      return;
    }

    const trimmedName = duplicateNewName.trim();

    try {
      setError(null);
      const result = await window.electron.ipcRenderer.invoke(
        'projects:duplicate',
        {
          sourcePath: duplicateSource.path,
          newName: trimmedName,
        },
      );

      if (result.success) {
        await fetchProjects();
        onProjectSelect(result.project);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      handleCancelDuplicateModal();
    }
  };

  const handleRevealProject = async (project: Project) => {
    try {
      setError(null);
      const result = await window.electron.ipcRenderer.invoke(
        'projects:reveal',
        project.path,
      );
      if (!result.success) {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteProject = (project: Project) => {
    Modal.confirm({
      title: `Delete project "${project.name}"?`,
      content:
        'This permanently removes the project folder and any generated files.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setError(null);
          const result = await window.electron.ipcRenderer.invoke(
            'projects:delete',
            project.path,
          );
          if (result.success) {
            await fetchProjects();
            onProjectDeleted(project);
          } else {
            setError(result.message);
          }
        } catch (err: any) {
          setError(err.message);
          throw err;
        }
      },
    });
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery) {
      return projects;
    }
    const lowercasedQuery = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(lowercasedQuery) ||
        p.artists?.toLowerCase().includes(lowercasedQuery),
    );
  }, [projects, searchQuery]);

  const containerClassName = `project-hub-container project-hub-container--${variant}`;

  const getMenuItems = (project: Project): MenuProps['items'] => [
    {
      key: 'rename',
      label: 'Rename',
      onClick: () => handleShowRenameModal(project),
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      onClick: () => handleShowDuplicateModal(project),
    },
    {
      key: 'reveal',
      label: 'Show in Finder',
      onClick: () => handleRevealProject(project),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      label: 'Delete Project',
      onClick: () => handleDeleteProject(project),
      danger: true,
    },
  ];

  return (
    <>
      <div className={containerClassName}>
        <header className={`hub-header hub-header--${variant}`}>
          {variant === 'sidebar' ? (
            <>
              <h2>Project Hub</h2>
              <p>Manage projects and switch between them.</p>
            </>
          ) : (
            <>
              <h1>Engeloop Contract Generator</h1>
              <p>Select a project to begin or create a new one.</p>
            </>
          )}
        </header>
        <main className={`hub-main hub-main--${variant}`}>
          {error && (
            <p className="hub-error" style={{ color: 'red' }}>
              Error: {error}
            </p>
          )}
          <div className="hub-actions">
            <button
              type="button"
              className="hub-button primary"
              onClick={handleShowCreateModal}
            >
              + Create New Project
            </button>
            <button
              type="button"
              className="hub-button"
              onClick={onOpenSettings}
            >
              Settings
            </button>
          </div>
          <div className="project-list-container">
            <div className="project-list-header">
              <h2>
                {variant === 'sidebar' ? 'Projects' : 'Existing Projects'}
              </h2>
              {variant === 'sidebar' && (
                <Input
                  className="project-search-input"
                  placeholder="Filter projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  prefix={<SearchOutlined />}
                  allowClear
                />
              )}
            </div>
            <div className="project-list-scroller">
              <ul className="project-list">
                {filteredProjects.length > 0 ? (
                  filteredProjects.map((p) => {
                    const isActive = activeProject?.path === p.path;
                    return (
                      <li
                        key={p.path}
                        className={`project-list-item${
                          isActive ? ' project-list-item--active' : ''
                        }`}
                      >
                        <button
                          type="button"
                          className="project-name-button"
                          onClick={() => onProjectSelect(p)}
                        >
                          <span
                            className={`project-name-text${
                              isActive ? ' project-name-text--active' : ''
                            }`}
                          >
                            {p.name}
                          </span>
                          {p.artists && (
                            <Text className="project-artist-subtitle" ellipsis>
                              {p.artists}
                            </Text>
                          )}
                        </button>
                        <div className="project-actions">
                          <Dropdown
                            menu={{ items: getMenuItems(p) }}
                            trigger={['hover']}
                            placement="bottomRight"
                          >
                            <Button
                              className="project-action-menu-button"
                              type="text"
                              icon={<MoreOutlined />}
                              onClick={(e) => e.stopPropagation()} // Prevents the list item click event
                            />
                          </Dropdown>
                        </div>
                      </li>
                    );
                  })
                ) : (
                  <li className="project-list-item-empty">
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        searchQuery
                          ? 'No projects match your search.'
                          : 'No projects found.'
                      }
                    />
                  </li>
                )}
              </ul>
            </div>
          </div>
        </main>
      </div>

      {/* Create Project Modal */}
      <Modal
        title="Create New Project"
        open={isCreateModalVisible}
        onOk={handleCreateProject}
        onCancel={handleCancelCreateModal}
        okText="Create"
        cancelText="Cancel"
      >
        <Input
          placeholder="Enter project name..."
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onPressEnter={handleCreateProject}
        />
      </Modal>

      {/* Duplicate Project Modal */}
      <Modal
        title={`Duplicate Project${
          duplicateSource ? `: ${duplicateSource.name}` : ''
        }`}
        open={isDuplicateModalVisible}
        onOk={handleDuplicateProject}
        onCancel={handleCancelDuplicateModal}
        okText="Duplicate"
        cancelText="Cancel"
      >
        <Input
          placeholder="Enter name for duplicated project..."
          value={duplicateNewName}
          onChange={(e) => setDuplicateNewName(e.target.value)}
          onPressEnter={handleDuplicateProject}
        />
      </Modal>

      {/* Rename Project Modal */}
      <Modal
        title={`Rename Project: ${renameTarget?.name}`}
        open={isRenameModalVisible}
        onOk={handleRenameProject}
        onCancel={handleCancelRenameModal}
        okText="Rename"
        cancelText="Cancel"
      >
        <Input
          placeholder="Enter new project name..."
          value={renameNewName}
          onChange={(e) => setRenameNewName(e.target.value)}
          onPressEnter={handleRenameProject}
        />
      </Modal>
    </>
  );
}
