import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { useT } from '../i18n/react';
import { acceptsFile, pickFiles, wrapFile } from '../engine/io';
import type { PickedFile } from '../engine/types';

type Props = {
  label: string;
  hint?: string;
  accept: 'pdf' | 'image' | 'any';
  multiple?: boolean;
  camera?: boolean;
  onFiles: (f: PickedFile[]) => void;
  compact?: boolean;
};

// Web: a real DOM wrapper so drag-and-drop works.
export function DropZone({ label, hint, accept, multiple, camera, onFiles, compact }: Props) {
  const { t } = useTheme();
  const tr = useT();
  const [over, setOver] = useState(false);
  const kind = accept === 'pdf' ? 'PDF' : accept === 'image' ? 'image' : 'file';
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const fs = Array.from(e.dataTransfer.files).filter((f) => acceptsFile(f, accept)).map(wrapFile);
        onFiles(multiple ? fs : fs.slice(0, 1));
      }}
      style={{
        border: `3px dashed ${t.line}`,
        borderRadius: 18,
        background: over ? t.duck : t.card,
        transition: 'background .15s',
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          const fs = await pickFiles({ accept, multiple, camera });
          if (fs.length) onFiles(fs);
        }}
        style={{ width: '100%', alignItems: 'center', paddingVertical: compact ? 22 : 36, paddingHorizontal: 16, gap: 6 }}
      >
        <Text style={{ fontSize: compact ? 28 : 38 }}>{accept === 'image' ? '🖼️' : '📄'}</Text>
        <Text style={{ color: over ? t.duckInk : t.ink, fontWeight: '900', fontSize: 17, textAlign: 'center' }}>{over ? tr('Drop it!') : label}</Text>
        <Text style={{ color: over ? t.duckInk : t.muted, fontSize: 14, textAlign: 'center' }}>
          {multiple ? tr('Drag files here, or click to browse') : tr('Drag a file here, or click to browse')}{camera ? ' / ' + tr('use the camera') : ''}
        </Text>
        {hint ? <Text style={{ color: over ? t.duckInk : t.muted, fontSize: 13, textAlign: 'center' }}>{hint}</Text> : null}
        <View style={{ marginTop: 6, borderWidth: 2, borderColor: t.line, borderRadius: 12, backgroundColor: t.duck, paddingHorizontal: 18, paddingVertical: 7 }}>
          <Text style={{ color: t.duckInk, fontWeight: '900' }}>{multiple ? tr('Select files') : tr('Select file')}</Text>
        </View>
      </Pressable>
    </div>
  );
}
