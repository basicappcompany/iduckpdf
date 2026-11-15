import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AI_DEFAULTS } from '../config';
import { useTheme, type Mode } from '../lib/theme';
import { clearAi, getAi, saveAi, type AiConfig } from '../lib/ai';
import { KEYS, removeItem } from '../lib/storage';
import { openExternal } from '../engine/io';
import { Banner, Btn, Card, Choice, Field, Hl, Screen, T, TextField } from '../ui/kit';
import { Seo } from '../lib/seo';
import { useT } from '../i18n/react';

export default function Settings() {
  const { mode, setMode } = useTheme();
  const tr = useT();
  const [provider, setProvider] = useState<AiConfig['provider']>('openai');
  const [key, setKey] = useState('');
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  // Load after mount so the pre-rendered page and the first browser render match.
  useEffect(() => {
    const cur = getAi();
    if (cur) {
      setProvider(cur.provider);
      setKey(cur.key);
      setModel(cur.model);
    }
  }, []);

  const def = AI_DEFAULTS[provider];

  return (
    <Screen narrow>
      <Seo path="/settings" />
      <T v="h1">
        <Hl>{tr('Settings')}</Hl>
      </T>

      <Card style={{ gap: 14 }}>
        <T v="h2">{tr('Appearance')}</T>
        <Choice
          options={[{ value: 'system', label: '🖥️ ' + tr('Match my device') }, { value: 'light', label: '☀️ ' + tr('Light') }, { value: 'dark', label: '🌙 ' + tr('Dark') }]}
          value={mode}
          onChange={(v) => setMode(v as Mode)}
        />
      </Card>

      <Card style={{ gap: 14 }}>
        <T v="h2">{tr('AI key (optional)')}</T>
        <T muted>
          {tr('The AI tools (summarise, ask, translate, flashcards and quiz, and pull data into Excel) use a key you provide. It is saved only in this browser and sent only to the provider you pick. It is never sent to iDuckPDF. Use a key with a spending limit, and delete it on shared computers.')}
        </T>
        <Field label={tr('Provider')}>
          <Choice options={Object.entries(AI_DEFAULTS).map(([value, v]) => ({ value, label: v.label }))} value={provider} onChange={(v) => { setProvider(v as AiConfig['provider']); setSaved(null); }} />
        </Field>
        <Field label={tr('API key')} hint={tr('Starts like sk-… for OpenAI or Anthropic, or AIza… for Google.')}>
          <TextField value={key} onChange={(v) => { setKey(v); setSaved(null); }} secure placeholder={tr('Paste your key')} />
        </Field>
        <Banner tone="warn">{tr('Shared computer? Remove your key when you are done.')}</Banner>
        <Field label={tr('Model (optional)')} hint={tr('Leave blank to use {model}. Providers rename models often, so change this if a request fails.', { model: def.model })}>
          <TextField value={model} onChange={(v) => { setModel(v); setSaved(null); }} placeholder={def.model} />
        </Field>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Btn label={tr('Save key')} disabled={!key.trim()} onPress={() => { saveAi({ provider, key: key.trim(), model: model.trim() }); setSaved(tr('Saved in this browser.')); }} />
          <Btn label={tr('Remove key')} variant="ghost" onPress={() => { clearAi(); setKey(''); setModel(''); setSaved(tr('Key removed.')); }} />
          <Btn label={tr('Get a key')} variant="ghost" onPress={() => openExternal(def.keyUrl)} />
        </View>
        {saved ? <Banner tone="ok">{saved}</Banner> : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <T v="h2">{tr('Local data')}</T>
        <T muted>{tr('Recent tools, your theme and your key are stored in this browser only.')}</T>
        <View style={{ alignSelf: 'flex-start' }}>
          <Btn
            label={tr('Clear recent tools')}
            variant="ghost"
            small
            onPress={() => {
              removeItem(KEYS.recent);
              setSaved(tr('Recent tools cleared.'));
            }}
          />
        </View>
      </Card>
    </Screen>
  );
}
