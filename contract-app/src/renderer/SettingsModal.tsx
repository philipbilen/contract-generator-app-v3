import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Button, Space, Divider } from 'antd';
import type { AppConfig, AppConfigUpdate } from '../common/types';

interface SettingsModalProps {
  open: boolean;
  config: AppConfig | null;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (update: AppConfigUpdate) => Promise<void>;
  onBrowseTemplates: () => Promise<string | null>;
}

type SettingsFormValues = {
  labelName?: string;
  labelLegalName?: string;
  labelAddress?: string;
  labelEmail?: string;
  labelSignatory?: string;
  distroPartner?: string;
  distroFee?: number;
  adaFee?: number;
  labelShare?: number;
  releaseTitle?: string;
  releaseDate?: string;
  releaseUPC?: string;
  releaseISRC?: string;
  templateDirectory?: string;
};

export default function SettingsModal({
  open,
  config,
  loading,
  onCancel,
  onSubmit,
  onBrowseTemplates,
}: SettingsModalProps) {
  const [form] = Form.useForm<SettingsFormValues>();

  useEffect(() => {
    if (!open) {
      return;
    }

    const defaults = config?.agreementDefaults ?? {};
    form.setFieldsValue({
      ...defaults,
      releaseDate: defaults.releaseDate ?? '',
      templateDirectory: config?.templateDirectory ?? '',
    });
  }, [config, form, open]);

  const handleBrowse = async () => {
    const selected = await onBrowseTemplates();
    if (selected) {
      form.setFieldValue('templateDirectory', selected);
    }
  };

  const handleResetTemplate = () => {
    form.setFieldValue('templateDirectory', '');
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    const { templateDirectory = '', ...agreementDefaults } = values;

    const update: AppConfigUpdate = {
      agreementDefaults,
      templateDirectory,
    };

    await onSubmit(update);
  };

  return (
    <Modal
      title="Settings"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      okText="Save Settings"
      cancelText="Cancel"
    >
      <Form form={form} layout="vertical">
        <Divider orientation="left">Defaults</Divider>
        <Form.Item label="Label Name" name="labelName">
          <Input placeholder="Label Name" />
        </Form.Item>
        <Form.Item label="Label Legal Name" name="labelLegalName">
          <Input placeholder="Label Legal Name" />
        </Form.Item>
        <Form.Item label="Label Address" name="labelAddress">
          <Input placeholder="Label Address" />
        </Form.Item>
        <Form.Item
          label="Label Email"
          name="labelEmail"
          rules={[{ type: 'email', message: 'Enter a valid email address' }]}
        >
          <Input placeholder="Label Email" />
        </Form.Item>
        <Form.Item label="Label Signatory" name="labelSignatory">
          <Input placeholder="Label Signatory" />
        </Form.Item>
        <Form.Item label="Distribution Partner" name="distroPartner">
          <Input placeholder="Distribution Partner" />
        </Form.Item>
        <Form.Item label="Distribution Fee (%)" name="distroFee">
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="ADA Fee (%)" name="adaFee">
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Label Share (%)" name="labelShare">
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Default Release Title" name="releaseTitle">
          <Input placeholder="Release Title" />
        </Form.Item>
        <Form.Item label="Default Release Date" name="releaseDate">
          <Input placeholder="YYYY-MM-DD" />
        </Form.Item>
        <Form.Item label="Default Release UPC" name="releaseUPC">
          <Input placeholder="UPC" />
        </Form.Item>
        <Form.Item label="Default Release ISRC" name="releaseISRC">
          <Input placeholder="ISRC" />
        </Form.Item>

        <Divider orientation="left">Template Directory</Divider>
        <Form.Item
          label="Contract Templates Directory"
          name="templateDirectory"
        >
          <Space.Compact style={{ width: '100%' }}>
            <Input placeholder="Leave blank to use the bundled templates" />
            <Button onClick={handleBrowse}>Browse</Button>
            <Button onClick={handleResetTemplate}>Clear</Button>
          </Space.Compact>
        </Form.Item>
      </Form>
    </Modal>
  );
}
