import { supabase } from './supabaseClient';

export const MODES = {
  STANDARD: 'standard',
  PREVENTATIVE: 'preventative',
};

export const MODE_CONFIG = {
  standard: {
    label: 'Standard Triage',
    description: 'Refer Grade 2+ cases only',
    referThreshold: 2, // Refer if grade >= 2
    flagThreshold: 50, // Flag if riskScore > 50
    sensitivity: 0.5,
    color: 'blue',
    icon: ' ',
  },
  preventative: {
    label: 'Preventative Screening',
    description: 'Aggressively flags Grade 1+ and borderline cases',
    referThreshold: 1, // Refer if grade >= 1
    flagThreshold: 35, // Flag if riskScore > 35
    sensitivity: 0.3,
    color: 'amber',
    icon: ' ',
  },
};

// Check if a patient should be referred based on current mode
export function shouldRefer(patient, mode = 'standard') {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.standard;
  if (patient.grade >= config.referThreshold) return true;
  if (patient.grade === 1 && (patient.risk_score || 0) > config.flagThreshold) return true;
  return false;
}

// Get risk label for a patient in current mode
export function getRiskLabel(patient, mode = 'standard') {
  if (shouldRefer(patient, mode)) return 'REFER';
  if (mode === 'preventative' && patient.grade === 1) return 'MONITOR CLOSELY';
  return 'ROUTINE';
}

export async function saveMode(userId, mode) {
  try {
    await supabase.from('screening_settings').upsert({
      user_id: userId, 
      screening_mode: mode,
      sensitivity_threshold: MODE_CONFIG[mode].sensitivity,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to save screening mode:", error);
  }
}

export async function loadMode(userId) {
  try {
    const { data } = await supabase.from('screening_settings')
      .select('screening_mode').eq('user_id', userId).maybeSingle();
    return data?.screening_mode || 'standard';
  } catch (error) {
    console.error("Failed to load screening mode:", error);
    return 'standard';
  }
}
