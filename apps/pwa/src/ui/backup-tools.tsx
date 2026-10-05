/**
 * Export, verify and restore controls, shared by onboarding, the Backups tab,
 * the lock screen and the damaged-vault screen.
 */

import { useId, useState } from 'react';
import { useT } from '../i18n.ts';
import type { BackupCheckSummary, CandidateSummary, FileOut } from '../protocol.ts';
import { Banner, Busy, PasswordInput, errorText, handOffFile, readFileBytes, useApp } from './common.tsx';

/** Two-step export: prepare (async, checked ciphertext), then hand off in a fresh gesture. */
export function ExportControl(props: { onOffered?: (sha256: string) => void }) {
  const t = useT();
  const { client } = useApp();
  const [file, setFile] = useState<FileOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offered, setOffered] = useState<string | null>(null);

  const prepare = async () => {
    setBusy(true);
    setError(null);
    try {
      setFile(await client.call('prepareExport'));
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!file) return;
    const outcome = await handOffFile(file);
    setOffered(outcome);
    client.call('recordExportOutcome', { kind: outcome, sha256: file.sha256 }).catch(() => {});
    if (outcome === 'export-offered') props.onOffered?.(file.sha256);
  };

  const reported = () => {
    if (file) client.call('recordExportOutcome', { kind: 'user-reported', sha256: file.sha256 }).catch(() => {});
    setOffered('user-reported');
  };

  return (
    <div className="stack">
      {!file && (
        <button type="button" onClick={prepare} disabled={busy}>
          {t('prepareBackup')}
        </button>
      )}
      {busy && <Busy label={t('preparing')} />}
      {file && (
        <>
          <p className="muted">{t('backupReady', { name: file.fileName })}</p>
          <button type="button" onClick={save} data-testid="save-backup">
            {t('saveBackup')}
          </button>
          {offered === 'export-offered' && (
            <button type="button" className="secondary" onClick={reported}>
              {t('iSavedIt')}
            </button>
          )}
          {offered && offered !== 'export-offered' && offered !== 'user-reported' && (
            <p className="muted">{t(`exportStatus_${offered.replace(/-/g, '_')}` as 'exportStatus_export_cancelled')}</p>
          )}
        </>
      )}
      {error && <Banner kind="error">{error}</Banner>}
    </div>
  );
}

function FilePicker(props: { onFile: (f: File | null) => void; testId: string }) {
  const t = useT();
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{t('chooseFile')}</label>
      <input id={id} type="file" data-testid={props.testId} onChange={(e) => props.onFile(e.target.files?.[0] ?? null)} />
    </div>
  );
}

/** Verify a saved external file; never imports or changes the vault. */
export function VerifyControl(props: { onVerified?: (r: BackupCheckSummary) => void }) {
  const t = useT();
  const { client } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BackupCheckSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const bytes = await readFileBytes(file);
      const pw = password;
      setPassword('');
      const r = await client.call('verifyBackup', { bytes, password: pw });
      setResult(r);
      props.onVerified?.(r);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  const relation = (r: BackupCheckSummary) => t(`relation_${r.relation.replace(/-/g, '_')}` as 'relation_unknown');

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void verify();
      }}
    >
      <FilePicker onFile={setFile} testId="verify-file" />
      <PasswordInput label={t('filePassword')} value={password} onChange={setPassword} autoComplete="off" name="verify-password" />
      <button type="submit" disabled={!file || !password || busy}>
        {t('verify')}
      </button>
      {busy && <Busy label={t('verifying')} />}
      {result && result.matchesCurrentHead && (
        <Banner kind="info">{t('verifyExact', { entries: result.counts.entries, rev: result.revision ?? '—' })}</Banner>
      )}
      {result && !result.matchesCurrentHead && result.relation === 'older-revision' && (
        <Banner kind="warn">{t('verifyOlderLocal', { rev: result.revision ?? '—' })}</Banner>
      )}
      {result && !result.matchesCurrentHead && result.relation !== 'older-revision' && (
        <Banner kind="warn">{t('verifyOther', { entries: result.counts.entries, rev: result.revision ?? '—', relation: relation(result) })}</Banner>
      )}
      {error && <Banner kind="error">{error}</Banner>}
    </form>
  );
}

/** Open a file as a candidate, show its summary, adopt it only after explicit confirmation. */
export function RestoreControl(props: { replacing: boolean; onDone: () => void }) {
  const t = useT();
  const { client } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState<CandidateSummary | null>(null);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await readFileBytes(file);
      const pw = password;
      setPassword('');
      setCandidate(await client.call('openCandidate', { bytes, password: pw }));
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  const adopt = async () => {
    setBusy(true);
    setError(null);
    try {
      await client.call('adoptCandidate', { confirmReplace: props.replacing });
      props.onDone();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <p className="muted">{t('restoreExplain')}</p>
      {!candidate && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void open();
          }}
        >
          <FilePicker onFile={setFile} testId="restore-file" />
          <PasswordInput label={t('filePassword')} value={password} onChange={setPassword} autoComplete="off" name="restore-password" />
          <button type="submit" disabled={!file || !password || busy}>
            {t('open')}
          </button>
        </form>
      )}
      {candidate && (
        <div className="card stack">
          <p>
            {t('candidateSummary', {
              entries: candidate.counts.entries,
              history: candidate.counts.historyVersions,
              groups: candidate.counts.groups,
              rev: candidate.revision ?? '—',
              relation: t(`relation_${candidate.relation.replace(/-/g, '_')}` as 'relation_unknown')
            })}
          </p>
          {candidate.readOnlyReason ? (
            <Banner kind="warn">{t('candidateReadOnly')}</Banner>
          ) : props.replacing ? (
            <>
              <Banner kind="warn">{t('replaceWarning')}</Banner>
              <label className="check">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> {t('replaceAck')}
              </label>
              <button type="button" className="danger" disabled={!ack || busy} onClick={adopt}>
                {t('replaceConfirm')}
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={adopt}>
              {t('adoptConfirm')}
            </button>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => {
              client.call('discardCandidate').catch(() => {});
              setCandidate(null);
            }}
          >
            {t('cancel')}
          </button>
        </div>
      )}
      {busy && <Busy label={t('working')} />}
      {error && <Banner kind="error">{error}</Banner>}
    </div>
  );
}
