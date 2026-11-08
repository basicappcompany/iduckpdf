import React from 'react';
import { View } from 'react-native';
import { READY, SOON } from '../tools';
import { Btn, Card, Hl, Screen, T } from '../ui/kit';
import { Logo } from '../ui/Logo';
import { Seo } from '../lib/seo';
import { SiteFooter } from '../ui/SiteFooter';

export default function About() {
  return (
    <Screen narrow>
      <Seo path="/about" />
      <Logo size={64} />
      <T v="h1">
        About <Hl>iDuckPDF</Hl>
      </T>
      <T muted style={{ fontSize: 17 }}>
        iDuckPDF is a toolbox for everyday PDF chores: joining, cutting, tidying, marking up, shrinking and cleaning. It is free, has no ads, and does not ask you to sign up.
      </T>

      <Card style={{ gap: 8 }}>
        <T v="h2">What happens to your files</T>
        <T>
          For {READY.filter((x) => !x.warn).length} of the {READY.length} tools, the PDF is read and rewritten inside your browser tab using JavaScript. It is not uploaded to our servers. When you close the tab, it is gone.
        </T>
        <T>
          The two AI tools are different. If you add your own API key, the text of the PDF you choose is sent to the AI provider you picked (OpenAI, Anthropic or Google), directly from your browser. Those tools say so before you start. We do not see that text or your key.
        </T>
        <T muted v="small">
          We are not claiming magic: your browser, extensions and any cloud-synced folders you use are outside our control. For highly sensitive files, use a trusted device.
        </T>
      </Card>

      <Card style={{ gap: 8 }}>
        <T v="h2">What it costs</T>
        <T>Nothing. Running the site is cheap because your own device does the work. Tips help cover hosting and development time.</T>
        <View style={{ alignSelf: 'flex-start' }}><Btn label="Support iDuckPDF" icon="💛" to="/donate" small /></View>
      </Card>

      <Card style={{ gap: 8 }}>
        <T v="h2">How it is built</T>
        <T>
          One React Native codebase (Expo) powers the website today. The same code is the starting point for Android and iPhone apps later. PDF editing uses open-source libraries (pdf-lib and pdf.js).
        </T>
        <T muted v="small">{READY.length} tools are live and {SOON.length} are on the roadmap.</T>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn label="Browse tools" to="/tools" />
        <Btn label="Privacy policy" variant="ghost" to="/privacy" />
        <Btn label="Terms of use" variant="ghost" to="/terms" />
        <Btn label="Send feedback" variant="ghost" to="/feedback" />
        <Btn label="Request a feature" variant="ghost" to="/request" />
      </View>
      <SiteFooter />
    </Screen>
  );
}
