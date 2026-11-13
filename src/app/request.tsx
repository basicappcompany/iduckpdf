import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SITE } from '../config';
import { SOON, byId } from '../tools';
import { sendMail } from '../lib/mail';
import { copyText } from '../engine/io';
import { Banner, Btn, Card, Choice, Field, Hl, Screen, T, TextField } from '../ui/kit';
import { Seo } from '../lib/seo';
import { useT } from '../i18n/react';

export default function Request() {
  const tr = useT();
  const { tool } = useLocalSearchParams<{ tool?: string }>();
  const pre = tool ? byId(String(tool)) : undefined;
  const [which, setWhich] = useState(pre ? pre.id : 'new');
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<'' | 'sent' | 'fallback'>('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const chosen = which === 'new' ? null : byId(which);
  const heading = chosen ? chosen.name : title.trim();
  const body = () => `${chosen ? `I would like: ${chosen.name}\n` : `Idea: ${title.trim()}\n`}\nWhat I would use it for:\n${why.trim() || '(not provided)'}${email.trim() ? `\n\nReply to: ${email.trim()}` : ''}\n\nFrom: iDuckPDF web`;
  const subject = `[iDuckPDF request] ${heading || 'New idea'}`;
  const ok = chosen ? true : !!title.trim();

  return (
    <Screen narrow>
      <Seo path="/request" />
      <T v="h1">
        {tr('Got an')} <Hl>{tr('idea')}</Hl>?
      </T>
      <T muted>{SOON.length ? tr('Pick something from the roadmap to push it up the list, or describe a brand new tool or improvement.') : tr('Every tool we announced is built. Describe a new tool or an improvement you would like, with a real example if you can.')}</T>
      <Card style={{ gap: 16 }}>
        <Field label={tr('What do you want?')}>
          <Choice
            options={[{ value: 'new', label: '✨ ' + tr('Something new') }, ...SOON.map((s) => ({ value: s.id, label: `${s.icon} ${tr(s.name)}` }))]}
            value={which}
            onChange={setWhich}
          />
        </Field>
        {which === 'new' ? (
          <Field label={tr('Short title')}>
            <TextField value={title} onChange={setTitle} placeholder={tr('e.g. Add bookmarks to a PDF')} />
          </Field>
        ) : null}
        <Field label={tr('What would you use it for?')} hint={tr('A real example makes it much easier to build the right thing.')}>
          <TextField value={why} onChange={setWhy} multiline placeholder={tr('I often need to…')} />
        </Field>
        <Field label={tr('Your email (optional)')} hint={tr('So we can tell you when it ships.')}>
          <TextField value={email} onChange={setEmail} placeholder="you@example.com" />
        </Field>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Btn label={tr('Send request')} icon="💡" disabled={!ok || busy} onPress={async () => { setBusy(true); setSent(await sendMail(subject, body(), email.trim())); setBusy(false); }} />
          <Btn label={copied ? tr('Copied!') : tr('Copy instead')} variant="ghost" disabled={!ok} onPress={async () => { setCopied(await copyText(`To: ${SITE.feedbackEmail}\nSubject: ${subject}\n\n${body()}`)); setTimeout(() => setCopied(false), 1500); }} />
        </View>
        {sent === 'sent' ? <Banner tone="ok">{tr('Thank you! Your request has been sent.')}</Banner> : null}
        {sent === 'fallback' ? <Banner tone="ok">{tr('Your mail app should have opened with the request ready to send. If nothing happened, use “Copy instead” and email {email}.', { email: SITE.feedbackEmail })}</Banner> : null}
      </Card>
    </Screen>
  );
}
