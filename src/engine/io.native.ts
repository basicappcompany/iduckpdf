// Mobile apps are future scope. These stubs keep the native bundle compiling.
import { Linking } from 'react-native';
import type { PickedFile } from './types';
import { ToolError } from './util';

export type PickOpts = { accept: 'pdf' | 'image' | 'any'; multiple?: boolean; camera?: boolean };

const later = () => new ToolError('The mobile apps are coming later. Please use the website for now.');

export function wrapFile(): PickedFile {
  throw later();
}
export function acceptsFile(): boolean {
  return true;
}
export async function pickFiles(_o: PickOpts): Promise<PickedFile[]> {
  throw later();
}
export function saveFile(): void {
  throw later();
}
export async function copyText(): Promise<boolean> {
  return false;
}
export function openExternal(url: string): void {
  Linking.openURL(url);
}
export function openMail(url: string): void {
  Linking.openURL(url);
}
