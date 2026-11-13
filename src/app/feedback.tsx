import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SITE } from '../config';
import { byId } from '../tools';
import { sendMail } from '../lib/mail';
import { copyText } from '../engine/io';
import { Banner, Btn, Card, Choice, Field, Hl, Screen, T, TextField } from '../ui/kit';
import { Seo } from '../lib/seo';
import { useT } from '../i18n/react';

export default function Feedback() {
  const tr = useT();
  const KINDS = [
    { value: 'Bug', label: '🐞 ' + tr('Something broke') },
    { value: 'Improvement', label: '✨ ' + tr('Could be better') },
    { value: 'Praise', label: '👏 ' + tr('It worked great') },
    { value: 'Other', label: '💭 ' + tr('Something else') },
  ];
  const { tool } = useLocalSearchParams<{ tool?: string }>();
  const t = tool ? byId(String(tool)) : undefined;
  const [kind, setKind] = useState('Bug');
  const [msg, setMsg] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<'' | 'sent' | 'fallback'>('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const body = () => `${msg.trim()}\n\n— — —\nType: ${kind}${t ? `\nTool: ${t.name}` : ''}${email.trim() ? `\nReply to: ${email.trim()}` : ''}\nFrom: iDuckPDF web`;
  const subject = `[iDuckPDF feedback] ${kind}${t ? ` · ${t.name}` : ''}`;

  return (
    <Screen narrow>
      <Seo path="/feedback" />
      <T v="h1">
        {tr('Tell us')} <Hl>{tr('everything')}</Hl>
      </T>
      <T muted>{tr('Found a bug? Loved something? Hated something? A real person reads this.')}{t ? ' ' + tr('You are writing about “{name}”.', { name: tr(t.name) }) : ''}</T>
      <Card style={{ gap: 16 }}>
        <Field label={tr('What kind of feedback?')}>
          <Choice options={KINDS} value={kind} onChange={setKind} />
        </Field>
        <Field label={tr('Your message')} hint={kind === 'Bug' ? tr('What did you do, what did you expect, what happened instead? The tool and file type help a lot. Please do not paste private document contents.') : undefined}>
          <TextField value={msg} onChange={setMsg} multiline placeholder={tr('Write here…')} />
        </Field>
        <Field label={tr('Your email (optional)')} hint={tr('Only if you would like a reply.')}>
          <TextField value={email} onChange={setEmail} placeholder="you@example.com" />
        </Field>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Btn
            label={tr('Send feedback')}
            icon="📮"
            disabled={!msg.trim() || busy}
            onPress={async () => {
              setBusy(true);
              setSent(await sendMail(subject, body(), email.trim()));
              setBusy(false);
            }}
          />
          <Btn label={copied ? tr('Copied!') : tr('Copy message instead')} variant="ghost" disabled={!msg.trim()} onPress={async () => { setCopied(await copyText(`To: ${SITE.feedbackEmail}\nSubject: ${subject}\n\n${body()}`)); setTimeout(() => setCopied(false), 1500); }} />
        </View>
        {sent === 'sent' ? <Banner tone="ok">{tr('Thank you! Your message has been sent.')}</Banner> : null}
        {sent === 'fallback' ? <Banner tone="ok">{tr('Your mail app should have opened with the message ready to send. If nothing happened, use “Copy message instead” and email {email}.', { email: SITE.feedbackEmail })}</Banner> : null}
      </Card>
    </Screen>
  );
}
