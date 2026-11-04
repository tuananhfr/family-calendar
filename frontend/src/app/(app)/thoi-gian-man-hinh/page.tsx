import type { Metadata } from 'next';
import { ScreenTimeScreen } from '@/features/screen-time/ScreenTimeScreen';

export const metadata: Metadata = { title: 'Thời gian màn hình' };

export default function ScreenTimePage() { return <ScreenTimeScreen />; }
