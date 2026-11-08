import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useWidth } from '../lib/useWidth';
import { useTheme } from '../lib/theme';
import { READY, bestMatch, type ToolDef } from '../tools';
import { Btn, Chip, TextField, T } from '../ui/kit';
import { Logo } from '../ui/Logo';
import { Seo } from '../lib/seo';

type Msg = { id: number; from: 'bot' | 'me'; text?: string; tool?: ToolDef; links?: { label: string; to: string }[] };

const STARTERS = ['Combine some PDFs', 'Make a PDF smaller', 'Turn photos into a PDF', 'Hide private info', 'Add page numbers', 'Is my file safe?'];

function respond(text: string): Omit<Msg, 'id' | 'from'> {
  const s = text.toLowerCase();
  if (/^(hi|hello|hey|yo|hiya)\b/.test(s)) return { text: 'Hi! 🦆 Tell me what you want to do with your PDF, like “join two files” or “shrink this for email”.' };
  if (/(safe|private|privacy|secure|upload|server|data)/.test(s)) return { text: 'Most tools run inside your browser tab, so your PDF is processed on your device and not uploaded to us. The AI tools are the exception: with your own key, the text goes to the AI provider you choose. They warn you first.', links: [{ label: 'How it works', to: '/about' }] };
  if (/(bug|broken|not working|error|problem|issue|crash|feedback)/.test(s)) return { text: 'Sorry about that! Tell us what happened and which file type it was, and we will look into it.', links: [{ label: 'Send feedback', to: '/feedback' }] };
  if (/(feature|suggest|wish|idea|missing|add a tool|request)/.test(s)) return { text: 'We love ideas. Tell us what you wish this site could do.', links: [{ label: 'Request a feature', to: '/request' }, { label: 'See the roadmap', to: '/roadmap' }] };
  if (/(donate|support|tip|coffee|sponsor|pay)/.test(s)) return { text: 'That is kind of you. There are no ads or paywalls here, and tips keep it that way.', links: [{ label: 'Support iDuckPDF', to: '/donate' }] };
  if (/(api key|settings|dark mode|theme|my key)/.test(s)) return { text: 'Theme and AI keys live in Settings.', links: [{ label: 'Open Settings', to: '/settings' }] };
  const tool = bestMatch(text);
  if (tool) return { tool, text: tool.status === 'ready' ? `That sounds like “${tool.name}”.` : `That sounds like “${tool.name}”, which is on the roadmap but not built yet.` };
  return { text: 'Hmm, I am not sure which tool that is. Try words like merge, split, compress, rotate, watermark or text. Or browse everything.', links: [{ label: 'Browse all tools', to: '/tools' }] };
}

export default function Helper() {
  const { t } = useTheme();
  const width = useWidth();
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: 'bot', text: 'Hi, I am Duck 🦆 What do you need to do with your PDF today?' }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scroller = useRef<any>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const id = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [msgs, typing]);

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || typing) return;
    setMsgs((m) => [...m, { id: nextId.current++, from: 'me', text: clean }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setMsgs((m) => [...m, { id: nextId.current++, from: 'bot', ...respond(clean) }]);
      setTyping(false);
    }, 450);
  };

  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Seo path="/chat" />
      <View style={{ flex: 1, width: '100%', maxWidth: 780, paddingHorizontal: width < 600 ? 12 : 20 }}>
        <View style={{ paddingTop: 16 }}>
          <T v="h1" style={{ fontSize: 26, lineHeight: 30, letterSpacing: -0.5 }}>Ask the PDF helper</T>
          <T v="small" muted>Describe your PDF job in plain words and get pointed to the right free tool.</T>
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
                    <T v="h3">{m.tool.icon} {m.tool.name}</T>
                    <T v="small" muted>{m.tool.short}</T>
                    <View style={{ alignSelf: 'flex-start' }}>
                      <Btn label={m.tool.status === 'ready' ? `Open ${m.tool.name}` : 'See details'} small to={`/tool/${m.tool.id}`} />
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
              {STARTERS.map((s) => <Chip key={s} label={s} onPress={() => send(s)} small />)}
            </View>
          ) : null}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 14, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <TextField value={input} onChange={setInput} placeholder="e.g. “I need to split a scanned contract”" style={{ borderRadius: 999, paddingHorizontal: 18 }} />
          </View>
          <Btn label="Send" onPress={() => send(input)} disabled={!input.trim() || typing} />
        </View>
        <T v="small" muted style={{ textAlign: 'center', paddingBottom: 10 }}>The helper matches your words to tools ({READY.length} ready). It is not an AI and never sees your files.</T>
      </View>
    </View>
  );
}
