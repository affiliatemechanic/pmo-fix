import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'PMOfix'
const SITE_URL = 'https://pmofix.com'

interface MatchedFix {
  name: string
  summary: string
  url?: string
  price_note?: string
}

interface MatchResultEmailProps {
  firstName?: string
  verdict?: 'match' | 'recommended' | 'gap'
  headline?: string
  reasoning?: string
  nextSteps?: string[]
  matchedFix?: MatchedFix | null
  problemPreview?: string
}

const verdictLabel: Record<string, string> = {
  match: 'Fix found',
  recommended: 'Recommended fix',
  gap: 'Gap identified',
}

export const MatchResultEmail = ({
  firstName,
  verdict = 'gap',
  headline = 'We logged your PMO',
  reasoning = '',
  nextSteps = [],
  matchedFix = null,
  problemPreview = '',
}: MatchResultEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{headline}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>
          PMO<span style={{ color: '#0d0d0d' }}>fix</span>
        </Text>

        <Text style={tagline}>{verdictLabel[verdict] ?? 'Your PMO verdict'}</Text>
        <Heading style={h1}>
          {firstName ? `${firstName}, ` : ''}
          {headline}
        </Heading>

        {problemPreview ? (
          <Section style={quoteBox}>
            <Text style={quoteLabel}>You said:</Text>
            <Text style={quoteText}>"{problemPreview}"</Text>
          </Section>
        ) : null}

        {reasoning ? <Text style={text}>{reasoning}</Text> : null}

        {matchedFix ? (
          <Section style={fixCard}>
            <Text style={fixLabel}>The fix</Text>
            <Heading style={h2}>{matchedFix.name}</Heading>
            <Text style={text}>{matchedFix.summary}</Text>
            {matchedFix.price_note ? (
              <Text style={priceNote}>{matchedFix.price_note}</Text>
            ) : null}
            {matchedFix.url ? (
              <Button style={button} href={matchedFix.url}>
                Get this fix
              </Button>
            ) : null}
          </Section>
        ) : (
          <Section style={gapCard}>
            <Text style={fixLabel}>What this means</Text>
            <Text style={text}>
              Nothing in our current fix library nails this one. We've flagged it
              as a build candidate — the more people who vent about the same
              thing, the faster we build it.
            </Text>
          </Section>
        )}

        {nextSteps.length > 0 ? (
          <>
            <Heading style={h3}>Next steps</Heading>
            <ul style={list}>
              {nextSteps.map((s, i) => (
                <li key={i} style={listItem}>
                  {s}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <Hr style={hr} />
        <Text style={footer}>
          Sent by {SITE_NAME} · <a href={SITE_URL} style={link}>pmofix.com</a>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MatchResultEmail,
  subject: (data: Record<string, any>) =>
    data.headline ? `PMOfix: ${data.headline}` : 'Your PMOfix verdict',
  displayName: 'Match result',
  previewData: {
    firstName: 'Jane',
    verdict: 'match',
    headline: 'We have a fix for this',
    reasoning:
      "You're rebuilding the same client report every Monday. That's exactly what our weekly-report automation is built for.",
    nextSteps: [
      'Try the Weekly Report Autopilot template',
      'Connect your data source in under 5 minutes',
    ],
    matchedFix: {
      name: 'Weekly Report Autopilot',
      summary:
        'Generates branded client reports from your data sources every Monday at 6am.',
      url: 'https://pmofix.com/fixes/weekly-report-autopilot',
      price_note: '$29/mo',
    },
    problemPreview: 'I waste 4 hours every Monday rebuilding the same client report.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
const brand = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#b8860b',
  margin: '0 0 24px',
  letterSpacing: '-0.02em',
}
const tagline = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.18em',
  color: '#b8860b',
  margin: '0 0 8px',
  fontWeight: 'bold' as const,
}
const h1 = {
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: '#0d0d0d',
  margin: '0 0 24px',
  lineHeight: '1.25',
}
const h2 = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#0d0d0d',
  margin: '8px 0 12px',
}
const h3 = {
  fontSize: '14px',
  fontWeight: 'bold' as const,
  color: '#0d0d0d',
  margin: '28px 0 12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
}
const text = {
  fontSize: '15px',
  color: '#3a3a3a',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const quoteBox = {
  borderLeft: '3px solid #b8860b',
  padding: '12px 16px',
  margin: '0 0 24px',
  backgroundColor: '#faf7f0',
}
const quoteLabel = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
  color: '#8a7a4a',
  margin: '0 0 6px',
}
const quoteText = {
  fontSize: '14px',
  color: '#3a3a3a',
  lineHeight: '1.5',
  margin: 0,
  fontStyle: 'italic' as const,
}
const fixCard = {
  border: '1px solid #e8e4dd',
  borderRadius: '12px',
  padding: '20px 22px',
  margin: '8px 0 24px',
  backgroundColor: '#ffffff',
}
const gapCard = {
  border: '1px dashed #d6d2c8',
  borderRadius: '12px',
  padding: '20px 22px',
  margin: '8px 0 24px',
  backgroundColor: '#fafaf7',
}
const fixLabel = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
  color: '#b8860b',
  margin: '0 0 6px',
  fontWeight: 'bold' as const,
}
const priceNote = {
  fontSize: '13px',
  color: '#7a7a7a',
  margin: '0 0 16px',
}
const button = {
  backgroundColor: '#0d0d0d',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '12px 22px',
  textDecoration: 'none',
  display: 'inline-block',
}
const list = { paddingLeft: '20px', margin: '0 0 16px' }
const listItem = {
  fontSize: '15px',
  color: '#3a3a3a',
  lineHeight: '1.6',
  margin: '0 0 8px',
}
const hr = { borderColor: '#e8e4dd', margin: '32px 0 16px' }
const footer = { fontSize: '12px', color: '#999999', margin: 0 }
const link = { color: '#b8860b', textDecoration: 'none' }
