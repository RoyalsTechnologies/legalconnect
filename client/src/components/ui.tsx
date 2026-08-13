import type { FormInstance } from 'antd';
import { Alert, Card as AntCard, Empty, Flex, Select, Space, Spin, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import type { ApprovalStatus, ConsultationStatus, Urgency } from '../api/types';
import { GHANA_REGIONS } from '../constants/ghana';

const { Title, Paragraph, Text } = Typography;

type Tone = 'neutral' | 'info' | 'success' | 'warn' | 'danger';

const toneColor: Record<Tone, string> = {
  neutral: 'default',
  info: 'blue',
  success: 'success',
  warn: 'warning',
  danger: 'error',
};

export function StatusTag({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return <Tag color={toneColor[tone]}>{children}</Tag>;
}

/** Alias kept so existing call sites can import Badge. */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <StatusTag tone={tone}>{children}</StatusTag>;
}

const consultationLabels: Record<ConsultationStatus, { label: string; tone: Tone }> = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'warn' },
  PENDING: { label: 'Awaiting reply', tone: 'warn' },
  ACCEPTED: { label: 'Accepted', tone: 'success' },
  DECLINED: { label: 'Declined', tone: 'neutral' },
  COMPLETED: { label: 'Completed', tone: 'info' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export function ConsultationBadge({ status }: { status: ConsultationStatus }) {
  const { label, tone } = consultationLabels[status];
  return <StatusTag tone={tone}>{label}</StatusTag>;
}

const approvalLabels: Record<ApprovalStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pending review', tone: 'warn' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
};

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const { label, tone } = approvalLabels[status];
  return <StatusTag tone={tone}>{label}</StatusTag>;
}

const urgencyLabels: Record<Urgency, { label: string; tone: Tone }> = {
  NORMAL: { label: 'Normal', tone: 'neutral' },
  IMPORTANT: { label: 'Important', tone: 'warn' },
  URGENT: { label: 'Urgent', tone: 'danger' },
};

export function UrgencyBadge({ urgency }: { urgency: Urgency | null }) {
  if (!urgency) return <StatusTag tone="neutral">Not set</StatusTag>;
  const { label, tone } = urgencyLabels[urgency];
  return <StatusTag tone={tone}>{label}</StatusTag>;
}

export function Card({
  children,
  className,
  title,
  hoverable,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  hoverable?: boolean;
  onClick?: () => void;
}) {
  return (
    <AntCard className={className} title={title} hoverable={hoverable} onClick={onClick}>
      {children}
    </AntCard>
  );
}

export function InitialsAvatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className={size === 'lg' ? 'lc-avatar lc-avatar--lg' : 'lc-avatar'} aria-hidden>
      {initials || '·'}
    </span>
  );
}

export function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-block',
        marginBottom: 8,
        color: '#5c6b82',
        fontWeight: 600,
        textDecoration: 'none',
      }}
    >
      ← {children}
    </Link>
  );
}

export function RegionSelect({
  allowClear,
  placeholder = 'Select a region',
  value,
  onChange,
}: {
  allowClear?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <Select
      showSearch
      allowClear={allowClear}
      optionFilterProp="label"
      placeholder={placeholder}
      value={value || undefined}
      onChange={(next) => onChange?.(next ?? '')}
      options={GHANA_REGIONS.map((region) => ({ value: region, label: region }))}
      style={{ width: '100%' }}
    />
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <Flex vertical align="center" justify="center" style={{ padding: '2.5rem 0' }} gap={12}>
      <Spin size="large" />
      <Text type="secondary">{label}</Text>
    </Flex>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return <Alert type="error" showIcon message={message} />;
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Flex justify="space-between" align="flex-end" gap={16} wrap="wrap">
      <div style={{ maxWidth: 640 }}>
        {eyebrow ? (
          <Text strong style={{ color: '#1f4a9a' }}>
            {eyebrow}
          </Text>
        ) : null}
        <Title level={2} className="lc-display" style={{ marginTop: eyebrow ? 4 : 0 }}>
          {title}
        </Title>
        {description ? (
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {description}
          </Paragraph>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
    </Flex>
  );
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatGhs(pesewas: number): string {
  return `GH₵ ${(pesewas / 100).toFixed(2)}`;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Space direction="vertical" size={4}>
          <Text strong>{title}</Text>
          <Text type="secondary">{description}</Text>
        </Space>
      }
    >
      {action}
    </Empty>
  );
}

type FieldData = Parameters<FormInstance['setFields']>[0][number];

/** Map API field-error objects onto Ant Design Form field names. */
export function toFormFields(errors: Record<string, string>): FieldData[] {
  return Object.entries(errors).map(([name, error]) => ({
    name,
    errors: [error],
  }));
}
