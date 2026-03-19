/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code for RBI Private Lending</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://otcmkkxzoxbghgrwjybz.supabase.co/storage/v1/object/public/email-assets/rbi-logo.jpeg" alt="RBI Private Lending" width="80" height="80" style={logo} />
        <Heading style={h1}>Confirm your identity</Heading>
        <Text style={text}>Use the code below to verify your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const logo = { margin: '0 0 20px', borderRadius: '8px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1B2A4A', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#64748b', lineHeight: '1.6', margin: '0 0 25px' }
const codeStyle = { fontFamily: "'JetBrains Mono', Courier, monospace", fontSize: '28px', fontWeight: 'bold' as const, color: '#1B2A4A', letterSpacing: '4px', margin: '0 0 30px' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '30px 0 0' }
