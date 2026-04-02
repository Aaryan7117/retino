import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

/**
 * RoleSelect — Initial classification for new users.
 * Allows choosing between Medical Professional (Doctor) and Patient/Individual.
 */
export default function RoleSelect({ userId, onComplete }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  const selectRole = async (role) => {
    setIsUpdating(true);
    setError(null);
    try {
      // Initialize/Update the profile with the selected role
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ 
          id: userId, 
          role: role,
          profile_complete: false // Onboarding still required
        })
        .select()
        .single();

      if (error) throw error;
      if (onComplete) onComplete(data);
      // Force navigate to onboarding (Navigate component has no Router context here)
      window.location.href = role === 'doctor' ? '/onboarding/doctor' : '/onboarding/patient';
    } catch (e) {
      console.error('Role selection failed:', e);
      setError('Failed to update profile. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className='min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center p-6 font-["Outfit"]'>
      <div className='max-w-2xl w-full space-y-12 animate-fade-in'>
        <div className='text-center space-y-4'>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-600/10 border border-violet-500/20 text-violet-400 text-xs font-black uppercase tracking-[0.2em]'>
            Welcome to RetinaScan AI
          </div>
          <h1 className='text-4xl md:text-5xl font-black text-white tracking-tighter'>
            Select your <span className='text-violet-500'>Account Type</span>
          </h1>
          <p className='text-slate-500 font-medium text-lg'>
            To provide the best diagnostic experience, please tell us how you'll be using the platform.
          </p>
        </div>

        {error && (
          <div className='bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-sm font-bold text-center'>
            {error}
          </div>
        )}

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {/* DOCTOR CARD */}
          <button
            onClick={() => selectRole('doctor')}
            disabled={isUpdating}
            className='group relative flex flex-col p-8 rounded-[32px] bg-[#111827] border border-[#1F2937] hover:border-violet-500/50 transition-all text-left hover:scale-[1.02] shadow-2xl overflow-hidden'
          >
            <div className='absolute top-0 right-0 w-32 h-32 bg-violet-600/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-violet-600/10 transition-colors' />
            <div className='w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform'>
              🩺
            </div>
            <h3 className='text-2xl font-black text-white mb-2'>Medical Professional</h3>
            <p className='text-slate-500 text-sm font-medium leading-relaxed'>
              For ophthalmologists, optometrists, and clinic administrators conducting screenings.
            </p>
            <div className='mt-8 flex items-center gap-2 text-violet-400 text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity'>
              Select Doctor <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </div>
          </button>

          {/* PATIENT CARD */}
          <button
            onClick={() => selectRole('patient')}
            disabled={isUpdating}
            className='group relative flex flex-col p-8 rounded-[32px] bg-[#111827] border border-[#1F2937] hover:border-blue-500/50 transition-all text-left hover:scale-[1.02] shadow-2xl overflow-hidden'
          >
            <div className='absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-blue-600/10 transition-colors' />
            <div className='w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform'>
              👤
            </div>
            <h3 className='text-2xl font-black text-white mb-2'>Patient / Individual</h3>
            <p className='text-slate-500 text-sm font-medium leading-relaxed'>
              For individuals tracking their own screening results and finding nearby experts.
            </p>
            <div className='mt-8 flex items-center gap-2 text-blue-400 text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity'>
              Select Patient <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </div>
          </button>
        </div>

        {isUpdating && (
          <div className='flex items-center justify-center gap-3 text-slate-500 text-xs font-black uppercase tracking-widest'>
            <div className='w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin' />
            Finalizing Role Selection...
          </div>
        )}
      </div>
    </div>
  );
}
