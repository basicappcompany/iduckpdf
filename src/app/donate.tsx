import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { DONATE } from '../config';
import { useTheme } from '../lib/theme';
import { Banner, Btn, Card, Chip, Field, Hl, Screen, T, TextField } from '../ui/kit';
import { Seo } from '../lib/seo';

export default function Donate() {
  const { t } = useTheme();
  const { thanks } = useLocalSearchParams<{ thanks?: string }>();
  const [amount, setAmount] = useState<number>(DONATE.presets[0]);
  const [custom, setCustom] = useState('');
  const [monthly, setMonthly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const value = custom.trim() ? Number(custom) : amount;
  const valid = Number.isFinite(value) && value >= 1 && value <= 500 && (!monthly || Number.isInteger(value)); // monthly tips are whole dollars

  const go = async () => {
    if (!valid) return setMsg({ tone: 'error', text: monthly ? 'Please choose a whole number of dollars between $1 and $500.' : 'Please choose an amount between $1 and $500.' });
    if (!DONATE.enabled) return setMsg({ tone: 'info', text: 'Tips are not switched on yet, but thank you for the thought. It really means a lot. 💛' });
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(DONATE.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: value, monthly }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start the checkout.');
      if (Platform.OS === 'web') window.location.assign(data.url);
    } catch (e: any) {
      setMsg({ tone: 'error', text: e?.message || 'Could not start the checkout. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen narrow>
      <Seo path="/donate" />
      <Text style={{ fontSize: 52 }}>💛</Text>
      <T v="h1">
        Keep it <Hl>free</Hl>
      </T>
      <T muted style={{ fontSize: 17 }}>
        iDuckPDF has no ads, no paywall and no account wall. A small tip pays for hosting and buys time to keep improving the tools and building new ones.
      </T>

      {thanks ? (
        <Card hot>
          <T v="h2" color={t.duckInk}>Thank you! 🎉</T>
          <T color={t.duckInk}>Your support is genuinely appreciated.</T>
        </Card>
      ) : null}

      <Card style={{ gap: 16 }}>
        <Field label="How often?">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Chip label="One time" on={!monthly} onPress={() => setMonthly(false)} />
            <Chip label="Every month" on={monthly} onPress={() => setMonthly(true)} />
          </View>
        </Field>
        <Field label="Choose an amount (USD)">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {DONATE.presets.map((p) => (
              <Chip key={p} label={`$${p}`} on={!custom.trim() && amount === p} onPress={() => { setAmount(p); setCustom(''); }} />
            ))}
          </View>
        </Field>
        <Field label="Or type your own" hint={monthly ? 'A whole number between $1 and $500.' : 'Between $1 and $500.'}>
          <TextField value={custom} onChange={(v) => setCustom(v.replace(/[^0-9.]/g, ''))} placeholder="e.g. 7" numeric />
        </Field>
        <Btn label={busy ? 'Opening checkout…' : `Donate ${valid ? '$' + value : ''}${valid && monthly ? ' a month' : ''}`.trim()} icon="💛" onPress={go} disabled={busy} />
        {msg ? <Banner tone={msg.tone === 'error' ? 'error' : 'warn'}>{msg.text}</Banner> : null}
        <T v="small" muted>
          Payments are handled by Dodo Payments, who act as the seller of record. You will see their secure checkout page. We never see your card details.{monthly ? ' A monthly tip renews every month until you cancel it, and you can cancel at any time in Dodo’s customer portal.' : ''}
        </T>
      </Card>

      <T v="small" muted>
        Tips are optional and do not unlock anything, since everything here is free either way. Mistakes can be refunded within 14 days: see the terms.
      </T>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn label="Terms of use" variant="ghost" small to="/terms" />
        <Btn label="Privacy policy" variant="ghost" small to="/privacy" />
      </View>

      <Card style={{ gap: 6 }}>
        <T v="h3">Other ways to help</T>
        <T muted>Tell a friend, report a bug, or suggest the next tool. All of that helps just as much.</T>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          <Btn label="Request a feature" icon="💡" small variant="ghost" to="/request" />
          <Btn label="Send feedback" icon="📮" small variant="ghost" to="/feedback" />
        </View>
      </Card>
    </Screen>
  );
}
