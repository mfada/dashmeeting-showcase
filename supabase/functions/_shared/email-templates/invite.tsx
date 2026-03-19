/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to RBI Private Lending</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://otcmkkxzoxbghgrwjybz.supabase.co/storage/v1/object/public/email-assets/rbi-logo.jpeg" alt="RBI Private Lending" width="80" height="80" style={logo} />
        <Heading style={h1}>You've been invited</Heading>
        <Text style={text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={link}><strong>RBI Private Lending</strong></Link>.
          Click below to accept the invitation and set up your account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept Invitation
        </Button>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const logo = { margin: '0 0 20px', borderRadius: '8px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1B2A4A', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#64748b', lineHeight: '1.6', margin: '0 0 25px' }
const link = { color: '#1B2A4A', textDecoration: 'underline' }
const button = { backgroundColor: '#2E9E52', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '8px', padding: '12px 24px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '30px 0 0' }
