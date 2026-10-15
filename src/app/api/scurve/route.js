import { api } from '@/lib/http';
import { getCurve } from '@/lib/services/boq';
import { text } from '@/lib/validation';
export const GET=api(async request=>getCurve(text(new URL(request.url).searchParams.get('projectId'),'Proyek')));
