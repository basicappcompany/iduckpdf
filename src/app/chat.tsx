import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useWidth } from '../lib/useWidth';
import { HUB_PATH, toolPath } from '../content/toolSlugs';
import { ds } from '../lib/responsive';
import { useTheme } from '../lib/theme';
import { READY, bestMatch, type ToolDef } from '../tools';
import { intentOf } from '../i18n/intent';
import type { Lang } from '../i18n/locales';
import { Btn, Chip, TextField, T } from '../ui/kit';
import { Logo } from '../ui/Logo';
import { Seo } from '../lib/seo';
import { useLang, useT } from '../i18n/react';

type Msg = { id: number; from: 'bot' | 'me'; text?: string; tool?: ToolDef; links?: { label: string; to: string }[] };

type Tr = (s: string, v?: Record<string, string | number>) => string;

function respond(text: string, tr: Tr, lang: Lang): Omit<Msg, 'id' | 'from'> {
  const intent = intentOf(text, lang);
  if (intent === 'greet') return { text: tr('Hi! 🦆 Tell me what you want to do with your PDF, like “join two files” or “shrink this for email”.') };
  if (intent === 'privacy') return { text: tr('Most tools run inside your browser tab, so your PDF is processed on your device and not uploaded to us. The AI tools are the exception: with your own key, the text goes to the AI provider you choose. They warn you first.'), links: [{ label: tr('How it works'), to: '/about' }] };
  if (intent === 'bug') return { text: tr('Sorry about that! Tell us what happened and which file type it was, and we will look into it.'), links: [{ label: tr('Send feedback'), to: '/feedback' }] };
  if (intent === 'feature') return { text: tr('We love ideas. Tell us what you wish this site could do.'), links: [{ label: tr('Request a feature'), to: '/request' }, { label: tr('See the roadmap'), to: '/roadmap' }] };
  if (intent === 'support') return { text: tr('That is kind of you. There are no ads or paywalls here, and tips keep it that way.'), links: [{ label: tr('Support iDuckPDF'), to: '/donate' }] };
  if (intent === 'settings') return { text: tr('Theme and AI keys live in Settings.'), links: [{ label: tr('Open Settings'), to: '/settings' }] };
  const tool = bestMatch(text, lang);
  if (tool) return { tool, text: tool.status === 'ready' ? tr('That sounds like “{name}”.', { name: tr(tool.name) }) : tr('That sounds like “{name}”, which is on the roadmap but not built yet.', { name: tr(tool.name) }) };
  return { text: tr('Hmm, I am not sure which tool that is. Try words like merge, split, compress, rotate, watermark or text. Or browse everything.'), links: [{ label: tr('Browse all PDF tools'), to: HUB_PATH }] };
}

export default function Helper() {
  const { t } = useTheme();
  const tr = useT();
  const lang = useLang();
  const STARTERS = ['Combine some PDFs', 'Make a PDF smaller', 'Turn photos into a PDF', 'Hide private info', 'Add page numbers', 'Is my file safe?'];
  const starterLabel = (s: string) => ({ 'Combine some PDFs': tr('Combine some PDFs'), 'Make a PDF smaller': tr('Make a PDF smaller'), 'Turn photos into a PDF': tr('Turn photos into a PDF'), 'Hide private info': tr('Hide private info'), 'Add page numbers': tr('Add page numbers'), 'Is my file safe?': tr('Is my file safe?') } as Record<string, string>)[s] || s;
  const width = useWidth();
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: 'bot', text: tr('Hi, I am Duck 🦆 What do you need to do with your PDF today?') }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scroller = useRef<any>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const id = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [msgs, typing]);

  const send = (text: string, shown?: string) => {
    const clean = text.trim();
    if (!clean || typing) return;
    setMsgs((m) => [...m, { id: nextId.current++, from: 'me', text: shown ?? clean }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setMsgs((m) => [...m, { id: nextId.current++, from: 'bot', ...respond(clean, tr, lang) }]);
      setTyping(false);
    }, 450);
  };

  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Seo path="/chat" />
      <View {...ds('chatpad')} style={{ flex: 1, width: '100%', maxWidth: 780, paddingHorizontal: width < 600 ? 12 : 20 }}>
        <View style={{ paddingTop: 16 }}>
          <T v="h1" style={{ fontSize: 26, lineHeight: 36, letterSpacing: -0.5 }}>{tr('Ask the PDF helper')}</T>
          <T v="small" muted>{tr('Describe your PDF job in plain words and get pointed to the right free tool.')}</T>
        </View>
        <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          {msgs.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
              {m.from === 'bot' ? <Logo size={34} /> : null}
              <View
                style={[
                  { borderWidth: 2, borderColor: t.line, borderRadius: 18, padding: 12, gap: 10, backgroundColor: m.from === 'me' ? t.duck : t.card, flexShrink: 1 },
                  m.from === 'bot' ? { borderBottomLeftRadius: 4 } : { borderBottomRightRadius: 4 },
                  t.shadow(3),
                ]}
              >
                {m.text ? <T color={m.from === 'me' ? t.duckInk : undefined} style={m.from === 'me' ? { fontWeight: '700' } : undefined}>{m.text}</T> : null}
                {m.tool ? (
                  <View style={{ borderWidth: 2, borderColor: t.line, borderRadius: 12, padding: 10, gap: 6, backgroundColor: t.soft }}>
                    <T v="h3">{m.tool.icon} {tr(m.tool.name)}</T>
                    <T v="small" muted>{tr(m.tool.short)}</T>
                    <View style={{ alignSelf: 'flex-start' }}>
                      <Btn label={m.tool.status === 'ready' ? tr('Open {name}', { name: tr(m.tool.name) }) : tr('See details')} small to={toolPath(m.tool.id)} />
                    </View>
                  </View>
                ) : null}
                {m.links?.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {m.links.map((l) => <Btn key={l.to} label={l.label} small to={l.to} />)}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
          {typing ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
              <Logo size={34} />
              <View style={{ borderWidth: 2, borderColor: t.line, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: t.card }}>
                <Text style={{ color: t.muted, fontWeight: '900', letterSpacing: 2 }}>• • •</Text>
              </View>
            </View>
          ) : null}
          {msgs.length < 3 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 44 }}>
              {STARTERS.map((s) => <Chip key={s} label={starterLabel(s)} onPress={() => send(s, starterLabel(s))} small />)}
            </View>
          ) : null}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 14, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <TextField value={input} onChange={setInput} placeholder={tr('e.g. “I need to split a scanned contract”')} style={{ borderRadius: 999, paddingHorizontal: 18 }} />
          </View>
          <Btn label={tr('Send')} onPress={() => send(input)} disabled={!input.trim() || typing} />
        </View>
        <T v="small" muted style={{ textAlign: 'center', paddingBottom: 10 }}>{tr('The helper matches your words to tools ({n} ready). It is not an AI and never sees your files.', { n: READY.length })}</T>
      </View>
    </View>
  );
}
