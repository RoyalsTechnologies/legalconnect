import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Pagination,
  Row,
  Select,
  Space,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { categoriesApi, lawyersApi } from '../api/endpoints';
import type { LawyerView } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { PageShell } from '../components/Layout';
import { Badge, EmptyState, ErrorNotice, formatGhs, InitialsAvatar, Loading, PageHeading, RegionSelect } from '../components/ui';
import { useAsync } from '../hooks/useAsync';

const { Title, Paragraph, Text } = Typography;

const PAGE_SIZE = 12;

export function LawyerCard({ lawyer }: { lawyer: LawyerView }) {
  const navigate = useNavigate();

  return (
    <Card
      hoverable
      onClick={() => void navigate(`/lawyers/${lawyer.id}`)}
      style={{ height: '100%', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <InitialsAvatar name={lawyer.displayName} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <FlexHeader lawyer={lawyer} />
        </div>
      </div>
      <Paragraph type="secondary" className="lc-clamp-2" style={{ marginTop: 12, minHeight: 44 }}>
        {lawyer.bio}
      </Paragraph>
      <Space wrap size={[6, 6]} style={{ marginTop: 12 }}>
        {lawyer.practiceAreas.map(({ legalCategory }) => (
          <Badge key={legalCategory.id} tone="info">
            {legalCategory.name}
          </Badge>
        ))}
      </Space>
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          alignItems: 'baseline',
        }}
      >
        <Text type="secondary" style={{ fontSize: 13 }}>
          {lawyer.city}, {lawyer.region}
          {lawyer.yearsExperience !== null
            ? ` · ${lawyer.yearsExperience} yr${lawyer.yearsExperience === 1 ? '' : 's'}`
            : ''}
        </Text>
        <span className="lc-fee">{formatGhs(lawyer.consultationFeePesewas)}</span>
      </div>
    </Card>
  );
}

function FlexHeader({ lawyer }: { lawyer: LawyerView }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div>
        <Title level={4} className="lc-display" style={{ margin: 0 }}>
          {lawyer.displayName}
        </Title>
        {lawyer.firmName ? <Text type="secondary">{lawyer.firmName}</Text> : null}
      </div>
      <Badge tone={lawyer.isAvailable ? 'success' : 'neutral'}>
        {lawyer.isAvailable ? 'Accepting enquiries' : 'Not accepting'}
      </Badge>
    </div>
  );
}

export function LawyersPage() {
  // Filters live in the URL so a search can be shared, bookmarked, and survives a
  // back navigation from a profile.
  const [params, setParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(params.get('q') ?? '');
  const [regionDraft, setRegionDraft] = useState(params.get('region') ?? '');
  const { state } = useAuth();

  const categoryId = params.get('categoryId') ?? '';
  const region = params.get('region') ?? '';
  const search = params.get('q') ?? '';
  const rawPage = Number(params.get('page') ?? '1');
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  useEffect(() => {
    setSearchDraft(search);
    setRegionDraft(region);
  }, [search, region]);

  const categories = useAsync(() => categoriesApi.selectable(), [], 'Could not load categories.');

  const directory = useAsync(
    () =>
      lawyersApi.list({
        categoryId: categoryId || undefined,
        region: region || undefined,
        q: search || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
    [categoryId, region, search, page],
    'Could not load the lawyer directory.',
  );

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any filter change invalidates the current page number.
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  }

  const total = directory.status === 'ready' ? directory.data.total : 0;

  return (
    <PageShell showDisclaimer>
      <main className="lc-page">
        <PageHeading
          title="Find a legal professional"
          description="Browse approved lawyers by practice area and location. Contacting one starts a consultation request — it does not create a client relationship on its own."
        />

        {/* Browsing unaided assumes the visitor already knows which kind of lawyer
            they need, which is the exact difficulty this platform exists to remove. */}
        {state.status === 'anonymous' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 24 }}
            message={
              <>
                Not sure which kind of lawyer you need?{' '}
                <Link to="/register">
                  <Text strong style={{ color: '#1f4a9a' }}>
                    Create an account
                  </Text>
                </Link>{' '}
                and describe what happened in your own words — we will sort it out and suggest
                lawyers who handle that kind of matter.
              </>
            }
          />
        ) : null}

        <Card style={{ marginTop: 32 }}>
          <Form
            layout="vertical"
            onFinish={() => apply({ q: searchDraft.trim(), region: regionDraft.trim() })}
          >
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12} md={10}>
                <Form.Item label="Search" extra="Try a topic, a firm, or a name.">
                  <Input
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="e.g. unpaid salary"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={7}>
                <Form.Item label="Practice area">
                  <Select
                    value={categoryId || undefined}
                    allowClear
                    placeholder="All areas"
                    onChange={(value) => apply({ categoryId: value ?? '' })}
                    options={
                      categories.status === 'ready'
                        ? categories.data.map((category) => ({
                            value: category.id,
                            label: category.name,
                          }))
                        : []
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={7}>
                <Form.Item label="Region">
                  <RegionSelect
                    allowClear
                    placeholder="All regions"
                    value={regionDraft}
                    onChange={(value) => {
                      setRegionDraft(value);
                      apply({ region: value });
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Space>
              <Button type="primary" htmlType="submit">
                Search
              </Button>
              <Button
                type="text"
                onClick={() => {
                  setSearchDraft('');
                  setRegionDraft('');
                  setParams(new URLSearchParams());
                }}
              >
                Clear filters
              </Button>
            </Space>
          </Form>
        </Card>

        <div style={{ marginTop: 32 }}>
          {directory.status === 'loading' ? (
            <Loading label="Loading lawyers…" />
          ) : directory.status === 'error' ? (
            <ErrorNotice message={directory.message} />
          ) : directory.data.results.length === 0 ? (
            <EmptyState
              title="No lawyers match those filters"
              description="Try widening your search — remove the region, or choose a different practice area."
            />
          ) : (
            <>
              <Text type="secondary">
                {total} {total === 1 ? 'lawyer' : 'lawyers'} found
              </Text>
              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                {directory.data.results.map((lawyer) => (
                  <Col key={lawyer.id} xs={24} sm={12} lg={8}>
                    <LawyerCard lawyer={lawyer} />
                  </Col>
                ))}
              </Row>

              {total > PAGE_SIZE ? (
                <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
                  <Pagination
                    current={page}
                    pageSize={PAGE_SIZE}
                    total={total}
                    onChange={(nextPage) => apply({ page: String(nextPage) })}
                    showSizeChanger={false}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>
    </PageShell>
  );
}
