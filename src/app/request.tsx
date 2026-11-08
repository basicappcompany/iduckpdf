import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SITE } from '../config';
import { SOON, byId } from '../tools';
import { sendMail } from '../lib/mail';
import { copyText } from '../engine/io';
import { Banner, Btn, Card, Choice, Field, Hl, Screen, T, TextField } from '../ui/kit';
import { Seo } from '../lib/seo';

export default function Request() {
  const { tool } = useLocalSearchParams<{ tool?: string }>();
  const pre = tool ? byId(String(tool)) : undefined;
  const [which, setWhich] = useState(pre ? pre.id : 'new');
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
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
        Got an <Hl>idea</Hl>?
      </T>
      <T muted>Pick something from the roadmap to push it up the list, or describe a brand new tool or improvement.</T>
      <Card style={{ gap: 16 }}>
        <Field label="What do you want?">
          <Choice
            options={[{ value: 'new', label: '✨ Something new' }, ...SOON.map((s) => ({ value: s.id, label: `${s.icon} ${s.name}` }))]}
            value={which}
            onChange={setWhich}
          />
        </Field>
        {which === 'new' ? (
          <Field label="Short title">
            <TextField value={title} onChange={setTitle} placeholder="e.g. Add bookmarks to a PDF" />
          </Field>
        ) : null}
        <Field label="What would you use it for?" hint="A real example makes it much easier to build the right thing.">
          <TextField value={why} onChange={setWhy} multiline placeholder="I often need to…" />
        </Field>
        <Field label="Your email (optional)" hint="So we can tell you when it ships.">
          <TextField value={email} onChange={setEmail} placeholder="you@example.com" />
        </Field>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Btn label="Send request" icon="💡" disabled={!ok} onPress={() => { sendMail(subject, body()); setSent(true); }} />
          <Btn label={copied ? 'Copied!' : 'Copy instead'} variant="ghost" disabled={!ok} onPress={async () => { setCopied(await copyText(`To: ${SITE.feedbackEmail}\nSubject: ${subject}\n\n${body()}`)); setTimeout(() => setCopied(false), 1500); }} />
        </View>
        {sent ? <Banner tone="ok">Your mail app should have opened with the request ready to send. If nothing happened, use “Copy instead” and email {SITE.feedbackEmail}.</Banner> : null}
      </Card>
    </Screen>
  );
}
