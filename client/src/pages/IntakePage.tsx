import { Alert, Button, Card, Col, Form, Input, Row, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, fieldErrorsFromApi } from '../api/client';
import { intakesApi } from '../api/endpoints';
import { AiDisclaimer, PageShell } from '../components/Layout';
import { PageHeading, RegionSelect, toFormFields } from '../components/ui';

const { Title, Paragraph, Text } = Typography;

type IntakeValues = {
  description: string;
  city?: string;
  region?: string;
};

export function IntakePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<IntakeValues>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onFinish(values: IntakeValues) {
    setFormError(null);
    form.setFields([]);
    setSubmitting(true);
    try {
      const intake = await intakesApi.create({
        description: values.description.trim(),
        city: values.city?.trim() || undefined,
        region: values.region?.trim() || undefined,
      });
      void navigate(`/app/intakes/${intake.id}`, { replace: true });
    } catch (error) {
      form.setFields(toFormFields(fieldErrorsFromApi(error)));
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Something went wrong saving your request. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell showDisclaimer>
      <main className="lc-page lc-page--narrow">
        <PageHeading
          eyebrow="New enquiry"
          title="Tell us what happened"
          description="Write in everyday language. AI will help organise your request so a lawyer can understand it — it does not give legal advice."
        />

        <Card style={{ marginTop: 28 }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => void onFinish(values)}
            noValidate
            requiredMark={false}
          >
            <Form.Item
              label="What happened?"
              name="description"
              extra="A few sentences is enough. Include what you want help with."
              rules={[
                { required: true, message: 'Please describe what happened' },
                { min: 20, message: 'Please write at least 20 characters' },
                { max: 5000, message: 'Please keep this under 5000 characters' },
              ]}
            >
              <Input.TextArea
                rows={8}
                maxLength={5000}
                showCount
                placeholder="Example: My landlord gave me notice to leave within two weeks, but I have paid rent every month…"
              />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item label="City (optional)" name="city">
                  <Input placeholder="e.g. Accra" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Region (optional)" name="region">
                  <RegionSelect allowClear placeholder="e.g. Greater Accra" />
                </Form.Item>
              </Col>
            </Row>

            {formError ? (
              <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />
            ) : null}

            <AiDisclaimer />

            <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {submitting ? 'Organising your request…' : 'Continue'}
              </Button>
            </Form.Item>
            {submitting ? (
              <Text type="secondary" aria-live="polite">
                This can take a few moments. Your words are saved even if organisation is delayed.
              </Text>
            ) : null}
          </Form>
        </Card>
      </main>
    </PageShell>
  );
}
