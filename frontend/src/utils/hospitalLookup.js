import { supabase } from './supabaseClient';

export async function lookupHospitalByABHA(abhaId) {
    if (!abhaId || abhaId.trim() === '') return null;
    try {
        const { data } = await supabase.from('hospitals')
            .select('*').eq('insurance_id', abhaId.trim()).maybeSingle();
        return data || null;
    } catch { return null; }
}

export async function getNearbyHospitals(state, limit = 3) {
    try {
        const { data } = await supabase.from('hospitals')
            .select('*').eq('state', state).order('surgery_min_cost', { ascending: true })
            .limit(limit);
        return data || [];
    } catch { return []; }
}
