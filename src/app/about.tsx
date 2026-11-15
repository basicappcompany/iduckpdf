import { View } from 'react-native';
import { READY, SOON } from '../tools';
import { Btn, Card, Hl, Screen, T } from '../ui/kit';
import { Logo } from '../ui/Logo';
import { Seo } from '../lib/seo';
import { SiteFooter } from '../ui/SiteFooter';
import { SITE } from '../config';
import { useT } from '../i18n/react';

export default function About() {
  const tr = useT();
  return (
    <Screen narrow>
      <Seo path="/about" />
      <Logo size={64} />
      <T v="h1">
        {tr('About')} <Hl>iDuckPDF</Hl>
      </T>
      <T muted style={{ fontSize: 17 }}>
        {tr('iDuckPDF is a toolbox for everyday PDF chores: joining, cutting, tidying, signing, filling in forms, converting to and from Office files, reading scans, protecting, marking up, shrinking and cleaning. It is free, has no ads, and does not ask you to sign up.')}
      </T>

      <Card style={{ gap: 8 }}>
        <T v="h2">{tr('What happens to your files')}</T>
        <T>
          {tr('For {n} of the {total} tools, the PDF is read and rewritten inside your browser tab using JavaScript. It is not uploaded to our servers. When you close the tab, it is gone.', { n: READY.filter((x) => !x.warn).length, total: READY.length })}
        </T>
        <T>
          {tr('The AI tools are different. If you add your own API key, the text of the PDF you choose is sent to the AI provider you picked (OpenAI, Anthropic or Google), directly from your browser. Those tools say so before you start. We do not see that text or your key.')}
        </T>
        <T muted v="small">
          {tr('We are not claiming magic: your browser, extensions and any cloud-synced folders you use are outside our control. For highly sensitive files, use a trusted device.')}
        </T>
      </Card>

      <Card style={{ gap: 8 }}>
        <T v="h2">{tr('Who runs it')}</T>
        <T>{tr('iDuckPDF is made and operated by {operator}. Questions about the site, privacy or the terms? Email {email}.', { operator: SITE.operator, email: SITE.feedbackEmail })}</T>
      </Card>

      <Card style={{ gap: 8 }}>
        <T v="h2">{tr('What it costs')}</T>
        <T>{tr('Nothing. Running the site is cheap because your own device does the work. Tips help cover hosting and development time.')}</T>
        <View style={{ alignSelf: 'flex-start' }}><Btn label={tr('Support iDuckPDF')} icon="💛" to="/donate" small /></View>
      </Card>

      <Card style={{ gap: 8 }}>
        <T v="h2">{tr('How it is built')}</T>
        <T>
          {tr('One React Native codebase (Expo) powers the website today. The same code is the starting point for Android and iPhone apps later. PDF work uses open-source libraries: pdf-lib, pdf.js, JSZip and Tesseract.js (for OCR).')}
        </T>
        <T muted v="small">{SOON.length ? tr('{n} tools are live and {soon} are on the roadmap.', { n: READY.length, soon: SOON.length }) : tr('{n} tools are live, and every tool we announced is built.', { n: READY.length })}</T>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn label={tr('Browse tools')} to="/pdf-tools" />
        <Btn label={tr('Privacy policy')} variant="ghost" to="/privacy" />
        <Btn label={tr('Terms of use')} variant="ghost" to="/terms" />
        <Btn label={tr('Send feedback')} variant="ghost" to="/feedback" />
        <Btn label={tr('Request a feature')} variant="ghost" to="/request" />
      </View>
      <SiteFooter />
    </Screen>
  );
}
