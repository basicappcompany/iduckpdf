import type { ToolDef } from '../engine/types';
import { ToolError, baseName, needOne, pdfOut } from '../engine/util';

/**
 * Password protection. pdf-lib (the engine everything else uses) cannot read or write encrypted files, so these two tools use
 * @cantoo/pdf-lib, a fork that adds AES-256 encryption and decryption. It is imported on demand, so it is its own lazy chunk
 * that only downloads when one of these tools actually runs.
 */
async function engine() {
  return import('@cantoo/pdf-lib');
}

function randomSecret(length = 24): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const buf = new Uint32Array(length);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (n) => alphabet[n % alphabet.length]).join('');
}

export const secureTools: ToolDef[] = [
  {
    id: 'lock',
    name: 'Add a password',
    short: 'Encrypt a PDF so it needs a password to open.',
    desc: 'Protect a PDF with a password (AES-256) before you share it. The file is encrypted inside your browser tab, so the password and the document never leave your device.',
    category: 'privacy',
    icon: '🔒',
    keywords: ['encrypt', 'password', 'protect', 'secure', 'lock', 'password protect', 'aes', 'restrict'],
    inputs: [{ key: 'files', label: 'PDF to protect', accept: 'pdf' }],
    options: [
      { key: 'password', type: 'password', label: 'Password to open the file', placeholder: 'Choose a password', hint: 'Anyone who opens the PDF will be asked for this. We cannot recover it for you, so keep a copy somewhere safe.' },
      { key: 'confirm', type: 'password', label: 'Type it again', placeholder: 'Repeat the password' },
      { key: 'allowPrint', type: 'toggle', label: 'Allow printing', default: true },
      { key: 'allowCopy', type: 'toggle', label: 'Allow copying text and images', default: true, hint: 'Restrictions are honoured by most PDF viewers, but they are a courtesy: only the open-password is real security.' },
      { key: 'allowModify', type: 'toggle', label: 'Allow editing and annotating', default: false },
    ],
    runLabel: 'Add password',
    tips: ['Use a long password with several words. Short ones can be guessed.', 'The result is a new file. Your original is untouched, so keep it somewhere safe.'],
    faq: [
      { q: 'How strong is the protection?', a: 'The file is encrypted with AES-256, the strongest standard PDF encryption. The strength then depends on your password, so choose a long one.' },
      { q: 'Can you recover a forgotten password?', a: 'No. The password never leaves your browser, so there is nothing for us to recover. Keep a copy of the original file.' },
      { q: 'Will every PDF app open it?', a: 'Modern readers (Acrobat, Preview, Chrome, Edge, Firefox) open AES-256 files. Very old software may not.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const pw = String(opts.password || '');
      if (!pw) throw new ToolError('Type a password first.');
      if (pw.length < 4) throw new ToolError('Use at least 4 characters. A longer password is much safer.');
      if (pw !== String(opts.confirm || '')) throw new ToolError('The two passwords do not match.');
      progress(0.1, 'Loading the PDF…');
      const { PDFDocument } = await engine();
      let doc;
      try {
        doc = await PDFDocument.load(await f.bytes(), { ignoreEncryption: true });
      } catch {
        throw new ToolError(`“${f.name}” could not be read. It may be damaged. Try the Repair tool.`);
      }
      if (doc.isEncrypted) throw new ToolError('This PDF already has a password. Use “Remove a password” first if you want to set a new one.');
      progress(0.5, 'Encrypting…');
      doc.encrypt({
        userPassword: pw,
        ownerPassword: randomSecret(), // unknown to everyone, so the permissions below cannot be switched off with a second password
        permissions: {
          printing: opts.allowPrint ? 'highResolution' : false,
          copying: !!opts.allowCopy,
          modifying: !!opts.allowModify,
          annotating: !!opts.allowModify,
          fillingForms: true,
          contentAccessibility: true,
          documentAssembly: !!opts.allowModify,
        },
      });
      const bytes = await doc.save();
      progress(1);
      return { files: [pdfOut(`${baseName(f.name)}-protected.pdf`, bytes)], notes: ['Encrypted with AES-256. You will need the password to open it, so keep it safe.'] };
    },
  },
  {
    id: 'unlock',
    name: 'Remove a password',
    short: 'Unlock a PDF you have the password for.',
    desc: 'Take the password off a PDF you own so it opens freely. You need to know the password: this tool does not guess or break passwords. It also lifts printing and copying restrictions.',
    category: 'privacy',
    icon: '🔓',
    keywords: ['decrypt', 'password', 'unlock', 'open protected', 'remove password', 'restrictions', 'unprotect'],
    inputs: [{ key: 'files', label: 'Protected PDF', accept: 'pdf' }],
    options: [{ key: 'password', type: 'password', label: 'Password', placeholder: 'Leave empty if it opens without one', hint: 'Files that open fine but block printing or copying usually need no password here.' }],
    runLabel: 'Remove password',
    tips: ['This works only with the correct password. It does not crack or bypass anything.', 'Only unlock documents you have the right to use.'],
    faq: [
      { q: 'Can you unlock a PDF if I forgot the password?', a: 'No. This tool needs the password. It cannot guess or break passwords, and nothing is sent anywhere to try.' },
      { q: 'What if the PDF opens but I cannot print or copy?', a: 'That is a permissions restriction, not an open-password. Leave the password empty and the tool saves a copy without the restrictions.' },
      { q: 'Is my password sent to a server?', a: 'No. The file is decrypted inside your browser tab, and neither the file nor the password leaves your device.' },
    ],
    status: 'ready',
    async run({ files, opts, progress }) {
      const f = needOne(files.files);
      const pw = String(opts.password ?? '');
      progress(0.1, 'Checking the PDF…');
      const { PDFDocument } = await engine();
      const bytes = await f.bytes();
      let probe;
      try {
        probe = await PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch {
        throw new ToolError(`“${f.name}” could not be read. It may be damaged. Try the Repair tool.`);
      }
      if (!probe.isEncrypted) {
        return { files: [pdfOut(`${baseName(f.name)}-unlocked.pdf`, bytes)], notes: ['This PDF had no password or restrictions, so here is an unchanged copy.'] };
      }
      progress(0.5, 'Decrypting…');
      let doc;
      try {
        doc = await PDFDocument.load(bytes, { password: pw });
      } catch {
        throw new ToolError(pw ? 'That password did not work. Check it and try again.' : 'This PDF needs a password to open. Type it above.', 'wrong-password');
      }
      // Saving the decrypted document directly keeps a stale encryption entry in the file, which makes viewers ask for a
      // password again. Copying the pages into a fresh document gives a clean, unencrypted file.
      const clean = await PDFDocument.create();
      const copied = await clean.copyPages(doc, doc.getPageIndices());
      copied.forEach((p) => clean.addPage(p));
      for (const [get, set] of [
        [doc.getTitle, clean.setTitle],
        [doc.getAuthor, clean.setAuthor],
        [doc.getSubject, clean.setSubject],
        [doc.getCreator, clean.setCreator],
      ] as const) {
        const v = get.call(doc);
        if (v) set.call(clean, v);
      }
      const out = await clean.save();
      progress(1);
      return { files: [pdfOut(`${baseName(f.name)}-unlocked.pdf`, out)], notes: ['The password and restrictions are removed. Anyone can open this copy, so store it carefully. Bookmarks and form fields are not carried over.'] };
    },
  },
];
