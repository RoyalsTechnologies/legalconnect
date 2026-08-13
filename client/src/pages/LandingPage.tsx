import { Button, Flex, Space, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { PageShell } from '../components/Layout';
import { Card } from '../components/ui';

const { Title, Paragraph, Text } = Typography;

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=2400&q=80';

const STEPS = [
  {
    step: '1',
    title: 'Tell us what happened',
    body: 'Write freely in plain language. You do not need the right legal terms.',
  },
  {
    step: '2',
    title: 'We organise your request',
    body: 'AI helps sort your concern into a clear summary a professional can review.',
  },
  {
    step: '3',
    title: 'Connect with a lawyer',
    body: 'See matched professionals with a clear reason for each suggestion, then send a request.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <PageShell showDisclaimer>
      <section className="lc-hero">
        <img src={HERO_IMAGE} alt="" className="lc-hero__media" fetchPriority="high" />
        <div className="lc-hero__overlay" aria-hidden />

        <div className="lc-hero__content">
          <div className="lc-hero__kicker">Access to legal professionals in Ghana</div>
          <Text
            className="lc-display"
            style={{
              display: 'block',
              color: '#fff',
              fontSize: 'clamp(2.4rem, 5.5vw, 4rem)',
              fontWeight: 600,
              lineHeight: 1.12,
              maxWidth: 720,
            }}
          >
            Describe what happened in your own words.
          </Text>
          <Title
            level={1}
            style={{
              color: 'rgba(255,255,255,0.88)',
              fontWeight: 500,
              fontSize: 'clamp(1.15rem, 2.2vw, 1.45rem)',
              maxWidth: 540,
              marginTop: 18,
            }}
          >
            We help you reach the right lawyer — they remain responsible for professional advice.
          </Title>
          <Space wrap size="middle" style={{ marginTop: 28 }}>
            <Button type="primary" size="large" onClick={() => void navigate('/register')}>
              Get started
            </Button>
            <Button size="large" ghost onClick={() => void navigate('/lawyers')}>
              Browse lawyers
            </Button>
          </Space>
          <div className="lc-trust">
            <span>No legal jargon required</span>
            <span>Pay only when you book</span>
            <span>You can browse before signing up</span>
          </div>
        </div>
      </section>

      <section style={{ background: '#fff', padding: '4.5rem 1.5rem', borderTop: '1px solid #d7deea' }}>
        <div className="lc-page" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <Text strong style={{ color: '#1f4a9a', letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 12 }}>
            How it works
          </Text>
          <Title level={2} className="lc-display" style={{ marginTop: 8, marginBottom: 8 }}>
            Three steps from your words to a lawyer
          </Title>
          <Paragraph type="secondary" style={{ maxWidth: 640, marginBottom: 36 }}>
            The platform organises and matches. It does not give legal advice, decide guilt, or
            predict a court outcome.
          </Paragraph>

          <Flex gap={16} wrap="wrap">
            {STEPS.map((item) => (
              <div key={item.step} className="lc-step">
                <div className="lc-step__num">{item.step}</div>
                <Title level={4} style={{ marginTop: 12, marginBottom: 8 }}>
                  {item.title}
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {item.body}
                </Paragraph>
              </div>
            ))}
          </Flex>
        </div>
      </section>

      <section style={{ padding: '3.5rem 1.5rem' }}>
        <div className="lc-page" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <Card>
            <Flex justify="space-between" align="flex-start" gap={24} wrap="wrap">
              <div style={{ maxWidth: 640 }}>
                <Title level={3} className="lc-display" style={{ marginTop: 0 }}>
                  Are you a lawyer?
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  Create a lawyer account with your practice details. An administrator reviews the
                  profile before it appears in the directory. Approval is a person checking this
                  record — not an automated licence register lookup.
                </Paragraph>
              </div>
              <Space wrap>
                <Button type="primary" onClick={() => void navigate('/register?as=lawyer')}>
                  Apply as a lawyer
                </Button>
                <Link to="/login">
                  <Button>Sign in</Button>
                </Link>
              </Space>
            </Flex>
          </Card>
        </div>
      </section>
    </PageShell>
  );
}
