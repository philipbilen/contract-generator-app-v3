import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Collapse,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Typography,
  Spin,
  message,
  Select,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type {
  AgreementDefaults,
  FormAgreementValues,
  LegacyArtistEntry,
  PersistedAgreement,
  PdfInput,
  Project,
} from '../common/types';
import { useConfig } from './ConfigContext';

const VALIDATION_DELAY_MS = 300;
const PREVIEW_DELAY_MS = 500;
const SAVE_DELAY_MS = 1000;

const FALLBACK_FORM_VALUES: FormAgreementValues = {
  labelName: 'Engeloop Records',
  labelLegalName: 'Algorythm Limited',
  labelAddress: 'Waterpoint Apartments, A6102, SLM 1020, Sliema, Malta',
  labelEmail: 'business@engeloop.com',
  labelSignatory: 'Philip Bilén',
  distroPartner: 'LoudKult AB',
  distroFee: 15,
  adaFee: 10,
  labelShare: 60,
  releaseTitle: '',
  releaseDate: null,
  releaseDateISO: null,
  releaseUPC: '',
  releaseISRC: '',
  mainArtists: [],
  featuredArtists: [],
  licensors: [],
  royaltyParties: [],
  artists: [],
};

const ensureLegacyArtists = (
  artists: FormAgreementValues['artists'],
): LegacyArtistEntry[] => {
  if (!Array.isArray(artists)) {
    return [];
  }
  return artists.map((artist) => ({
    stageName: artist?.stageName ?? '',
    legalName: artist?.legalName ?? '',
    address: artist?.address ?? '',
    email: artist?.email ?? '',
    role: artist?.role ?? 'Artist',
    royaltyShare:
      typeof artist?.royaltyShare === 'number'
        ? artist.royaltyShare
        : Number.isFinite(Number(artist?.royaltyShare))
          ? Number(artist?.royaltyShare)
          : undefined,
  }));
};

const parseDate = (value: unknown): Dayjs | null => {
  if (dayjs.isDayjs(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed : null;
  }
  return null;
};

const toFormValues = (
  persisted: PersistedAgreement | null,
  fallback: FormAgreementValues,
): FormAgreementValues => {
  const source = persisted ?? {};
  const clonedFallback: FormAgreementValues = {
    ...fallback,
    mainArtists: [...(fallback.mainArtists ?? [])],
    featuredArtists: [...(fallback.featuredArtists ?? [])],
    licensors: Array.isArray(fallback.licensors)
      ? fallback.licensors.map((item) => ({ ...item }))
      : [],
    royaltyParties: Array.isArray(fallback.royaltyParties)
      ? fallback.royaltyParties.map((item) => ({ ...item }))
      : [],
    artists: ensureLegacyArtists(fallback.artists),
  };

  const merged: FormAgreementValues = {
    ...clonedFallback,
    ...source,
    mainArtists: Array.isArray(source.mainArtists)
      ? [...source.mainArtists]
      : clonedFallback.mainArtists,
    featuredArtists: Array.isArray(source.featuredArtists)
      ? [...source.featuredArtists]
      : clonedFallback.featuredArtists,
    licensors: Array.isArray(source.licensors)
      ? source.licensors.map((item) => ({ ...item }))
      : clonedFallback.licensors,
    royaltyParties: Array.isArray(source.royaltyParties)
      ? source.royaltyParties.map((item) => ({ ...item }))
      : clonedFallback.royaltyParties,
    artists: ensureLegacyArtists(source.artists ?? clonedFallback.artists),
  };

  merged.releaseDate =
    parseDate(source.releaseDate) ?? parseDate(clonedFallback.releaseDate) ?? null;
  merged.releaseDateISO =
    typeof source.releaseDateISO === 'string'
      ? source.releaseDateISO
      : clonedFallback.releaseDateISO ?? null;

  return merged;
};

const toPersisted = (values: FormAgreementValues): PersistedAgreement => {
  const artists = ensureLegacyArtists(values.artists);
  const releaseDateIso = (() => {
    if (dayjs.isDayjs(values.releaseDate)) {
      return values.releaseDate.format('YYYY-MM-DD');
    }
    if (typeof values.releaseDate === 'string' && values.releaseDate.trim()) {
      const parsed = dayjs(values.releaseDate);
      return parsed.isValid()
        ? parsed.format('YYYY-MM-DD')
        : values.releaseDate.trim();
    }
    return values.releaseDateISO ?? null;
  })();

  return {
    ...values,
    releaseDate: releaseDateIso,
    releaseDateISO: releaseDateIso,
    artists,
  };
};

const toPdfInput = (values: FormAgreementValues): PdfInput => {
  const persisted = toPersisted(values);
  const iso = persisted.releaseDate ?? persisted.releaseDateISO ?? null;
  const formatted = iso ? dayjs(iso).format('MMMM D, YYYY') : '';

  return {
    ...persisted,
    releaseDate: formatted,
    releaseDateISO: iso,
    releaseDateFormatted: formatted,
  };
};

const cloneFormValues = (values: FormAgreementValues): FormAgreementValues => ({
  ...values,
  mainArtists: Array.isArray(values.mainArtists)
    ? [...values.mainArtists]
    : [],
  featuredArtists: Array.isArray(values.featuredArtists)
    ? [...values.featuredArtists]
    : [],
  licensors: Array.isArray(values.licensors)
    ? values.licensors.map((entry) => ({ ...entry }))
    : [],
  royaltyParties: Array.isArray(values.royaltyParties)
    ? values.royaltyParties.map((entry) => ({ ...entry }))
    : [],
  artists: ensureLegacyArtists(values.artists),
  releaseDate: values.releaseDate ? dayjs(values.releaseDate) : null,
});

const computeShareMetrics = (values: FormAgreementValues) => {
  const labelShare = Number(values.labelShare ?? 0);
  const artists = ensureLegacyArtists(values.artists);
  let invalid = false;

  const artistTotal = artists.reduce((sum, artist) => {
    const numeric = Number(artist?.royaltyShare ?? 0);
    if (!Number.isFinite(numeric)) {
      invalid = true;
      return sum;
    }
    return sum + numeric;
  }, 0);

  const total = Number.parseFloat((labelShare + artistTotal).toFixed(2));

  if (invalid) {
    return {
      total,
      error: 'Enter numeric royalty shares for all artists.',
    } as const;
  }

  if (Math.abs(total - 100) > 0.01) {
    return {
      total,
      error: `Total royalty allocation must equal 100%. Currently ${total}%`,
    } as const;
  }

  return { total, error: null } as const;
};

interface AgreementFormProps {
  onPdfGenerated: (path: string) => void;
  activeProject: Project;
}

export default function AgreementForm({
  onPdfGenerated,
  activeProject,
}: AgreementFormProps) {
  const { config } = useConfig();
  const [form] = Form.useForm<FormAgreementValues>();
  const [shareTotal, setShareTotal] = useState(0);
  const [shareError, setShareError] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewStale, setIsPreviewStale] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProjectLoading, setIsProjectLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingRef = useRef(false);

  const opIdRef = useRef(0);
  const lastValidOpIdRef = useRef<number | null>(null);
  const validatedSnapshotRef = useRef<FormAgreementValues | null>(null);
  const latestValuesRef = useRef<FormAgreementValues>(FALLBACK_FORM_VALUES);
  const currentProjectPathRef = useRef(activeProject.path);
  const lastSuccessfulOpIdRef = useRef<number | null>(null);
  const lastSuccessfulSnapshotRef = useRef<FormAgreementValues | null>(null);

  const defaults = useMemo(() => {
    const defaultsFromConfig: AgreementDefaults | null =
      config?.agreementDefaults ?? null;
    return toFormValues(defaultsFromConfig, FALLBACK_FORM_VALUES);
  }, [config]);

  const clearTimer = (ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const clearAllTimers = useCallback(() => {
    clearTimer(validationTimerRef);
    clearTimer(previewTimerRef);
    clearTimer(saveTimerRef);
  }, []);

  const resetOperationState = useCallback(() => {
    clearAllTimers();
    opIdRef.current += 1; // invalidate pending operations
    lastValidOpIdRef.current = null;
    validatedSnapshotRef.current = null;
    setPreviewStatus('idle');
    setPreviewError(null);
    setIsPreviewStale(false);
  }, [clearAllTimers]);

  const runAutoSave = useCallback(
    async (snapshot: FormAgreementValues, opId: number) => {
      if (opId !== opIdRef.current || lastValidOpIdRef.current !== opId) {
        return;
      }

      if (currentProjectPathRef.current !== activeProject.path) {
        return;
      }

      if (!window.electron?.ipcRenderer?.invoke) {
        return;
      }

      try {
        const payload = toPersisted(snapshot);
        const result = await window.electron.ipcRenderer.invoke(
          'projects:save-agreement-data',
          { projectPath: activeProject.path, agreementData: payload },
        );
        if (!result?.success) {
          messageApi.error(`Failed to auto-save: ${result?.message ?? 'Unknown error'}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        messageApi.error(`Error during auto-save: ${errorMessage}`);
      }
    },
    [activeProject.path, messageApi],
  );

  const runPdfGeneration = useCallback(
    async (
      snapshot: FormAgreementValues,
      opId: number,
      mode: 'preview' | 'final',
    ) => {
      if (!window.electron?.ipcRenderer?.invoke) {
        messageApi.error('PDF generation is unavailable in this environment.');
        return;
      }

      if (opId !== opIdRef.current || lastValidOpIdRef.current !== opId) {
        return;
      }

      if (currentProjectPathRef.current !== activeProject.path) {
        return;
      }

      setPreviewStatus('generating');
      setPreviewError(null);
      setIsGenerating(true);

      try {
        const pdfInput: PdfInput = toPdfInput(snapshot);
        const result = await window.electron.ipcRenderer.invoke(
          'generate-pdf',
          pdfInput,
          activeProject.path,
          { mode },
        );

        if (opId !== opIdRef.current) {
          return;
        }

        if (result?.success && typeof result.pdfPath === 'string') {
          onPdfGenerated(result.pdfPath);
          lastSuccessfulOpIdRef.current = opId;
          lastSuccessfulSnapshotRef.current = snapshot;
          setPreviewStatus('success');
          setIsPreviewStale(false);
        } else {
          throw new Error(result?.message ?? 'PDF generation failed.');
        }
      } catch (error) {
        if (opId === opIdRef.current) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          setPreviewStatus('error');
          setPreviewError(errorMessage);
          messageApi.error(`Failed to generate PDF: ${errorMessage}`);
        }
      } finally {
        if (opId === opIdRef.current) {
          setIsGenerating(false);
        }
      }
    },
    [activeProject.path, messageApi, onPdfGenerated],
  );

  const queuePreview = useCallback(
    (snapshot: FormAgreementValues, opId: number, immediate = false) => {
      const execute = () => runPdfGeneration(snapshot, opId, 'preview');
      clearTimer(previewTimerRef);
      if (immediate) {
        execute();
      } else {
        previewTimerRef.current = setTimeout(execute, PREVIEW_DELAY_MS);
      }
    },
    [runPdfGeneration],
  );

  const queueSave = useCallback(
    (snapshot: FormAgreementValues, opId: number, immediate = false) => {
      const execute = () => runAutoSave(snapshot, opId);
      clearTimer(saveTimerRef);
      if (immediate) {
        execute();
      } else {
        saveTimerRef.current = setTimeout(execute, SAVE_DELAY_MS);
      }
    },
    [runAutoSave],
  );

  const performValidation = useCallback(
    (snapshot: FormAgreementValues, opId: number) => {
      if (opId !== opIdRef.current) {
        return;
      }

      latestValuesRef.current = snapshot;
      const { total, error } = computeShareMetrics(snapshot);
      setShareTotal(total);
      setShareError(error);

      if (error) {
        lastValidOpIdRef.current = null;
        validatedSnapshotRef.current = null;
        clearTimer(previewTimerRef);
        clearTimer(saveTimerRef);
        return;
      }

      lastValidOpIdRef.current = opId;
      validatedSnapshotRef.current = snapshot;
      setIsPreviewStale(true);
      queuePreview(snapshot, opId);
      queueSave(snapshot, opId);
    },
    [queuePreview, queueSave],
  );

  const queueValidation = useCallback(
    (snapshot: FormAgreementValues, opId: number, immediate = false) => {
      const execute = () => performValidation(snapshot, opId);
      clearTimer(validationTimerRef);
      if (immediate) {
        execute();
      } else {
        validationTimerRef.current = setTimeout(execute, VALIDATION_DELAY_MS);
      }
    },
    [performValidation],
  );

  const handleValuesChange = useCallback(
    (
      _changed: Partial<FormAgreementValues>,
      allValues: FormAgreementValues,
    ) => {
      if (isHydratingRef.current || isProjectLoading) {
        return;
      }

      const snapshot = cloneFormValues(allValues);
      latestValuesRef.current = snapshot;
      const nextOpId = opIdRef.current + 1;
      opIdRef.current = nextOpId;
      queueValidation(snapshot, nextOpId);
    },
    [isProjectLoading, queueValidation],
  );

  const hydrateForm = useCallback(
    (persisted: PersistedAgreement | null) => {
      const hydrated = toFormValues(persisted, defaults);
      isHydratingRef.current = true;
      form.setFieldsValue(hydrated);
      isHydratingRef.current = false;
      latestValuesRef.current = hydrated;
      const nextOpId = opIdRef.current + 1;
      opIdRef.current = nextOpId;
      queueValidation(hydrated, nextOpId, true);
      setIsPreviewStale(false);
    },
    [defaults, form, queueValidation],
  );

  useEffect(() => {
    currentProjectPathRef.current = activeProject.path;
  }, [activeProject.path]);

  useEffect(() => {
    let cancelled = false;

    const loadProjectData = async () => {
      resetOperationState();
      setIsProjectLoading(true);

      try {
        const result = await window.electron?.ipcRenderer?.invoke(
          'projects:load-agreement-data',
          activeProject.path,
        );
        if (cancelled) {
          return;
        }
        if (result?.success) {
          hydrateForm(result.data as PersistedAgreement | null);
          if (result.data) {
            messageApi.success('Project data loaded.');
          } else {
            messageApi.info('New project initialized.');
          }
        } else {
          hydrateForm(null);
          messageApi.error(`Failed to load project data: ${result?.message ?? 'Unknown error'}`);
        }
      } catch (error) {
        if (!cancelled) {
          hydrateForm(null);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          messageApi.error(`Error loading project data: ${errorMessage}`);
        }
      } finally {
        if (!cancelled) {
          setIsProjectLoading(false);
        }
      }
    };

    loadProjectData();

    return () => {
      cancelled = true;
      clearAllTimers();
      opIdRef.current += 1;
    };
  }, [activeProject.path, hydrateForm, messageApi, clearAllTimers, resetOperationState]);

  useEffect(() => {
    if (!window.electron?.ipcRenderer) {
      return undefined;
    }

    const boundPath = activeProject.path;
    const handleManualSave = () => {
      if (boundPath !== currentProjectPathRef.current) {
        return;
      }
      const snapshot = cloneFormValues(form.getFieldsValue(true) as FormAgreementValues);
      const { total, error } = computeShareMetrics(snapshot);
      setShareTotal(total);
      setShareError(error);
      if (error) {
        messageApi.error(error);
        return;
      }
      const savedOpId = opIdRef.current + 1;
      opIdRef.current = savedOpId;
      lastValidOpIdRef.current = savedOpId;
      validatedSnapshotRef.current = snapshot;
      queueSave(snapshot, savedOpId, true);
      messageApi.success('Project saved manually.');
    };

    const disposer = window.electron.ipcRenderer.on(
      'menu:save-agreement',
      handleManualSave,
    );

    return () => {
      disposer?.();
    };
  }, [activeProject.path, form, messageApi, queueSave]);

  const handleManualGenerate = useCallback(() => {
    const snapshot = cloneFormValues(form.getFieldsValue(true) as FormAgreementValues);
    const { total, error } = computeShareMetrics(snapshot);
    setShareTotal(total);
    setShareError(error);
    if (error) {
      messageApi.error(error);
      return;
    }
    const nextOpId = opIdRef.current + 1;
    opIdRef.current = nextOpId;
    lastValidOpIdRef.current = nextOpId;
    validatedSnapshotRef.current = snapshot;
    queuePreview(snapshot, nextOpId, true);
    queueSave(snapshot, nextOpId);
  }, [form, messageApi, queuePreview, queueSave]);

  const handleFinalGenerate = useCallback(() => {
    const snapshot = cloneFormValues(form.getFieldsValue(true) as FormAgreementValues);
    const { total, error } = computeShareMetrics(snapshot);
    setShareTotal(total);
    setShareError(error);
    if (error) {
      messageApi.error(error);
      return;
    }
    const nextOpId = opIdRef.current + 1;
    opIdRef.current = nextOpId;
    lastValidOpIdRef.current = nextOpId;
    validatedSnapshotRef.current = snapshot;
    queueSave(snapshot, nextOpId, true);
    runPdfGeneration(snapshot, nextOpId, 'final');
  }, [form, messageApi, queueSave, runPdfGeneration]);

  const handleRetryPreview = useCallback(() => {
    const snapshot = validatedSnapshotRef.current ?? lastSuccessfulSnapshotRef.current;
    const opId = lastValidOpIdRef.current ?? lastSuccessfulOpIdRef.current;
    if (!snapshot || opId === null) {
      return;
    }
    queuePreview(snapshot, opId, true);
  }, [queuePreview]);

  return (
    <>
      {contextHolder}
      <Spin spinning={isProjectLoading} tip="Loading project data">
        <Form<FormAgreementValues>
          form={form}
          name="agreement"
          layout="vertical"
          autoComplete="off"
          className="agreement-form"
          size="middle"
          initialValues={defaults}
          onValuesChange={handleValuesChange}
          disabled={isProjectLoading}
        >
          <Collapse
            defaultActiveKey={['1', '2', '3', '4']}
            bordered={false}
            className="form-sections"
          >
            <Collapse.Panel header="Label Info" key="1">
              <div className="form-grid">
                <Form.Item
                  className="form-grid__item form-grid__item--half"
                  label="Label Name"
                  name="labelName"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  className="form-grid__item form-grid__item--half"
                  label="Label Legal Name"
                  name="labelLegalName"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  className="form-grid__item form-grid__item--full"
                  label="Label Address"
                  name="labelAddress"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  className="form-grid__item form-grid__item--half"
                  label="Label Email"
                  name="labelEmail"
                  rules={[{ required: true, type: 'email' }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  className="form-grid__item form-grid__item--half"
                  label="Label Signatory"
                  name="labelSignatory"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
              </div>
            </Collapse.Panel>
            <Collapse.Panel header="Distribution" key="2">
              <div className="form-grid">
                <Form.Item
                  className="form-grid__item form-grid__item--full"
                  label="Distribution Partner"
                  name="distroPartner"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  className="form-grid__item form-grid__item--one-third"
                  label="Distribution Fee (%)"
                  name="distroFee"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} max={100} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  className="form-grid__item form-grid__item--one-third"
                  label="ADA Fee (%)"
                  name="adaFee"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} max={100} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  className="form-grid__item form-grid__item--one-third"
                  label="Label Share (%)"
                  name="labelShare"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </div>
            </Collapse.Panel>
            <Collapse.Panel header="Release" key="3">
              <div className="form-grid">
                <Form.Item
                  className="form-grid__item form-grid__item--half"
                  label="Release Title"
                  name="releaseTitle"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  className="form-grid__item form-grid__item--half"
                  label="Release Date"
                  name="releaseDate"
                  rules={[{ required: true }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  className="form-grid__item form-grid__item--half"
                  label="Release UPC"
                  name="releaseUPC"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  className="form-grid__item form-grid__item--half"
                  label="Release ISRC"
                  name="releaseISRC"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
              </div>
            </Collapse.Panel>
            <Collapse.Panel header="Artists" key="4">
              <Form.List name="artists">
                {(fields, { add, remove }) => (
                  <div className="artist-list">
                    <Typography.Paragraph className="muted-text">
                      Add everyone who should appear on the agreement and define
                      their royalty share.
                    </Typography.Paragraph>

                    {fields.map(({ key, name, ...restField }) => (
                      <div key={key} className="artist-card">
                        <div className="form-grid form-grid--artist">
                          <Form.Item
                            {...restField}
                            className="form-grid__item form-grid__item--half"
                            name={[name, 'stageName']}
                            label="Stage Name"
                            rules={[{ required: true, message: 'Missing artist name' }]}
                          >
                            <Input placeholder="Artist Name" />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            className="form-grid__item form-grid__item--half"
                            name={[name, 'legalName']}
                            label="Legal Name"
                            rules={[{ required: true, message: 'Missing legal name' }]}
                          >
                            <Input placeholder="Legal Name" />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            className="form-grid__item form-grid__item--full"
                            name={[name, 'address']}
                            label="Address"
                            rules={[{ required: true, message: 'Missing address' }]}
                          >
                            <Input placeholder="Address" />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            className="form-grid__item form-grid__item--half"
                            name={[name, 'email']}
                            label="Email"
                            rules={[
                              {
                                required: true,
                                type: 'email',
                                message: 'Invalid email address',
                              },
                            ]}
                          >
                            <Input placeholder="Email" />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            className="form-grid__item form-grid__item--one-quarter"
                            name={[name, 'role']}
                            label="Role"
                            initialValue="Main Artist"
                            rules={[{ required: true, message: 'Missing role' }]}
                          >
                            <Select>
                              <Select.Option value="Main Artist">Main Artist</Select.Option>
                              <Select.Option value="Composer">Composer</Select.Option>
                              <Select.Option value="Producer">Producer</Select.Option>
                              <Select.Option value="Remixer">Remixer</Select.Option>
                              <Select.Option value="Featured Artist">Featured Artist</Select.Option>
                            </Select>
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            className="form-grid__item form-grid__item--one-quarter"
                            name={[name, 'royaltyShare']}
                            label="Royalty Share (%)"
                            rules={[{ required: true, message: 'Missing share' }]}
                          >
                            <InputNumber
                              min={0}
                              max={100}
                              placeholder="Share (%)"
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                          <div className="form-grid__item form-grid__item--one-quarter artist-card__actions">
                            <Button
                              type="text"
                              danger
                              icon={<MinusCircleOutlined />}
                              onClick={() => remove(name)}
                            >
                              Remove Artist
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add({ role: 'Artist' })}
                        block
                        icon={<PlusOutlined />}
                      >
                        Add Artist
                      </Button>
                    </Form.Item>
                  </div>
                )}
              </Form.List>
            </Collapse.Panel>
          </Collapse>

          <Form.Item
            validateStatus={shareError ? 'error' : undefined}
            help={shareError ?? undefined}
          >
            <Typography.Text type={shareError ? 'danger' : 'secondary'}>
              Total allocated share: {shareTotal}%
            </Typography.Text>
          </Form.Item>

          {previewStatus === 'error' && previewError ? (
            <Alert
              type="error"
              showIcon
              message="Preview failed"
              description={previewError}
              action={
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={handleRetryPreview}
                  disabled={isGenerating}
                >
                  Retry
                </Button>
              }
              style={{ marginBottom: 16 }}
            />
          ) : null}

          {previewStatus === 'success' && isPreviewStale ? (
            <Alert
              type="warning"
              showIcon
              message="Preview out of date"
              description="The PDF preview does not include your latest changes yet."
              action={
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={handleRetryPreview}
                  disabled={isGenerating}
                >
                  Refresh Preview
                </Button>
              }
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Form.Item>
            <Button
              type="primary"
              onClick={handleManualGenerate}
              loading={isGenerating && previewStatus === 'generating'}
              disabled={Boolean(shareError) || isProjectLoading}
            >
              {isGenerating && previewStatus === 'generating'
                ? 'Generating...'
                : 'Generate Preview'}
            </Button>
            <Button
              type="default"
              onClick={handleFinalGenerate}
              disabled={Boolean(shareError) || isGenerating || isProjectLoading}
              style={{ marginLeft: 8 }}
            >
              Generate Final Agreement
            </Button>
          </Form.Item>
        </Form>
      </Spin>
    </>
  );
}
