import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SITE } from '../config';
import { byId } from '../tools';
import { sendMail } from '../lib/mail';
import { copyText } from '../engine/io';
import { Banner, Btn, Card, Choice, Field, Hl, Screen, T, TextField } from '../ui/kit';
import { Seo } from '../lib/seo';

const KINDS = [
  { value: 'Bug', label: '🐞 Something broke' },
  { value: 'Improvement', label: '✨ Could be better' },
  { value: 'Praise', label: '👏 It worked great' },
  { value: 'Other', label: '💭 Something else' },
];

export default function Feedback() {
  const { tool } = useLocalSearchParams<{ tool?: string }>();
  const t = tool ? byId(String(tool)) : undefined;
  const [kind, setKind] = useState('Bug');
  const [msg, setMsg] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const body = () => `${msg.trim()}\n\n— — —\nType: ${kind}${t ? `\nTool: ${t.name}` : ''}${email.trim() ? `\nReply to: ${email.trim()}` : ''}\nFrom: iDuckPDF web`;
  const subject = `[iDuckPDF feedback] ${kind}${t ? ` · ${t.name}` : ''}`;

  return (
    <Screen narrow>
      <Seo path="/feedback" />
      <T v="h1">
        Tell us <Hl>everything</Hl>
      </T>
      <T muted>Found a bug? Loved something? Hated something? A real person reads this.{t ? ` You are writing about “${t.name}”.` : ''}</T>
      <Card style={{ gap: 16 }}>
        <Field label="What kind of feedback?">
          <Choice options={KINDS} value={kind} onChange={setKind} />
        </Field>
        <Field label="Your message" hint={kind === 'Bug' ? 'What did you do, what did you expect, what happened instead? The tool and file type help a lot. Please do not paste private document contents.' : undefined}>
          <TextField value={msg} onChange={setMsg} multiline placeholder="Write here…" />
        </Field>
        <Field label="Your email (optional)" hint="Only if you would like a reply.">
          <TextField value={email} onChange={setEmail} placeholder="you@example.com" />
        </Field>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Btn
            label="Send feedback"
            icon="📮"
            disabled={!msg.trim()}
            onPress={() => {
              sendMail(subject, body());
              setSent(true);
            }}
          />
          <Btn label={copied ? 'Copied!' : 'Copy message instead'} variant="ghost" disabled={!msg.trim()} onPress={async () => { setCopied(await copyText(`To: ${SITE.feedbackEmail}\nSubject: ${subject}\n\n${body()}`)); setTimeout(() => setCopied(false), 1500); }} />
        </View>
        {sent ? <Banner tone="ok">Your mail app should have opened with the message ready to send. If nothing happened, use “Copy message instead” and email {SITE.feedbackEmail}.</Banner> : null}
      </Card>
    </Screen>
  );
}
