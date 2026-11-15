import { Pressable, Text } from 'react-native';
import { useTheme } from '../lib/theme';
import { pickFiles } from '../engine/io';
import type { PickedFile } from '../engine/types';

type Props = { label: string; hint?: string; accept: 'pdf' | 'image' | 'any'; multiple?: boolean; camera?: boolean; onFiles: (f: PickedFile[]) => void; compact?: boolean };

// Mobile apps are future scope; this keeps the native bundle compiling.
export function DropZone({ label, accept, multiple, camera, onFiles }: Props) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={async () => {
        try {
          const fs = await pickFiles({ accept, multiple, camera });
          if (fs.length) onFiles(fs);
        } catch {
          /* mobile support is coming later */
        }
      }}
      style={{ borderWidth: 3, borderStyle: 'dashed', borderColor: t.line, borderRadius: 18, padding: 28, alignItems: 'center', backgroundColor: t.card }}
    >
      <Text style={{ color: t.ink, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}
