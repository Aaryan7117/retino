import { supabase } from './supabaseClient';

export async function lookupHospitalByABHA(abhaId) {
    if (!abhaId || typeof abhaId !== 'string' || abhaId.trim() === '') return null;
    const cleanId = abhaId.trim();
    try {
        // 1. Direct case-insensitive match on insurance_id
        const { data } = await supabase.from('hospitals')
            .select('*').ilike('insurance_id', cleanId).maybeSingle();
        if (data) return data;

        // 2. Flexible fallback: compare normalized alphanumeric strings
        const { data: allHospitals } = await supabase.from('hospitals').select('*');
        if (allHospitals && allHospitals.length > 0) {
            const normSearch = cleanId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const matched = allHospitals.find(h => {
                if (!h.insurance_id) return false;
                const normHosp = h.insurance_id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                return normHosp === normSearch || normHosp.includes(normSearch) || normSearch.includes(normHosp);
            });
            if (matched) return matched;
        }
        return null;
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
