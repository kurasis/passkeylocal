/** The real backup banner with synthetic statuses; never a product entrypoint. */
import { createRoot } from 'react-dom/client';
import { I18nContext, translator } from '../../../pwa/src/i18n.ts';
import { BackupStatusBanner } from '../../../pwa/src/ui/tabs.tsx';
import '../../../pwa/src/styles.css';

const root = createRoot(document.getElementById('root')!);
function render(changes: number, due: boolean) {
  root.render(<I18nContext.Provider value={{ lang: 'ru', t: translator('ru') }}><main>
    <BackupStatusBanner status={{ savedLocally: true, generation: 1 + changes, latestExport: null, latestVerified: null, verifiedGeneration: 1, changesSinceVerified: changes, unbackedSince: null, escalate: due }} />
  </main></I18nContext.Provider>);
}
Object.assign(window, { backupTest: { render } });
render(0, false);
