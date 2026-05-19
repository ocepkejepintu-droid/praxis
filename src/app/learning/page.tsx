import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LearningReportsPage() {
  redirect('/dashboard#learning-reports');
}
