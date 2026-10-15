import {api} from '@/lib/http';
import {bootstrapAccounts} from '@/lib/services/master';
export const POST=api(async(request,context,user)=>bootstrapAccounts(user));
