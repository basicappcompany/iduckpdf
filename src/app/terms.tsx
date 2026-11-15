import { TERMS } from '../content/legal';
import { LegalPage } from '../ui/LegalPage';

export default function Terms() {
  return <LegalPage path="/terms" doc={TERMS} />;
}
