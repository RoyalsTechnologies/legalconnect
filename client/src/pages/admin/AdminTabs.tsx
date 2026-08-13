import type { ReactNode } from 'react';
import { PageHeading } from '../../components/ui';

/** Page frame for admin screens. Section links live in the shared side menu. */
export function AdminShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="lc-shell__main">
      <PageHeading title={title} description={description} action={action} />
      <div style={{ marginTop: 28 }}>{children}</div>
    </div>
  );
}
