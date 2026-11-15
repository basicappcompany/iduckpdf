import { PRIVACY } from '../content/legal';
import { LegalPage } from '../ui/LegalPage';

export default function Privacy() {
  return <LegalPage path="/privacy" doc={PRIVACY} />;
}
