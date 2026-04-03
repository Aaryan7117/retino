import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

/**
 * PatientOnboarding — Simple form for individuals.
 * Captures all required Supabase profile columns.
 */
export default function PatientOnboarding({ userId, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    gender: 'Male',
    diabetic_history: 'No',
    location: '',
    district: '',
    state: '',
    phone: '',
    contact_number: '',
  });

  // Pull email from Supabase auth automatically
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        id: userId,
        ...formData,
        age: formData.age || null,
        email: email,
        role: 'patient',
        profile_complete: true,
        updated_at: new Date().toISOString(),
      };
      
      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;
      if (onComplete) onComplete(data);
    } catch (err) {
      console.error('Patient onboarding failed:', err);
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full bg-[#0A0F1E] border border-[#1F2937] rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all text-base placeholder:text-slate-600';
  const selectClass = inputClass + ' appearance-none';
  const labelClass = 'text-[10px] font-black text-slate-500 uppercase tracking-widest';

  return (
    <div className='min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center py-8 px-4 sm:px-6 font-["Outfit"] pb-safe'>
      <div className='max-w-2xl w-full space-y-10 animate-fade-in'>
        <div className='text-center space-y-3'>
          <h1 className='text-4xl font-black text-white tracking-tighter'>Personal <span className='text-blue-500'>Health Profile</span></h1>
          <p className='text-slate-500 font-medium'>Please finalize your profile details to track your diagnostic screening history.</p>
        </div>

        {error && (
          <div className='bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-sm font-bold text-center'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='card-elevated bg-[#111827] p-5 sm:p-8 md:p-10 space-y-6'>
          <div className='space-y-2'>
            <label className={labelClass}>Full Name</label>
            <input required type='text' placeholder='Your Full Name' className={inputClass}
              value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6'>
            <div className='space-y-2'>
              <label className={labelClass}>Age</label>
              <input required type='number' placeholder='Age' className={inputClass}
                value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} />
            </div>
            <div className='space-y-2'>
              <label className={labelClass}>Gender</label>
              <select className={selectClass}
                value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className='space-y-2'>
            <label className={labelClass}>Diabetic History</label>
            <select className={selectClass}
              value={formData.diabetic_history} onChange={e => setFormData({ ...formData, diabetic_history: e.target.value })}>
              <option>No</option>
              <option>Yes, Type-1</option>
              <option>Yes, Type-2</option>
              <option>Gestational</option>
              <option>Unknown</option>
            </select>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6'>
            <div className='space-y-2'>
              <label className={labelClass}>City / Location</label>
              <input required type='text' placeholder='Chennai, India' className={inputClass}
                value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
            </div>
            <div className='space-y-2'>
              <label className={labelClass}>District</label>
              <input type='text' placeholder='Your district' className={inputClass}
                value={formData.district} onChange={e => setFormData({ ...formData, district: e.target.value })} />
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6'>
            <div className='space-y-2'>
              <label className={labelClass}>State</label>
              <input type='text' placeholder='Tamil Nadu' className={inputClass}
                value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
            </div>
            <div className='space-y-2'>
              <label className={labelClass}>Phone Number</label>
              <input required type='tel' placeholder='91-XXXXXXXXXX' className={inputClass}
                value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
          </div>

          <div className='space-y-2'>
            <label className={labelClass}>Contact Number (Alternative)</label>
            <input type='tel' placeholder='Optional alternative number' className={inputClass}
              value={formData.contact_number} onChange={e => setFormData({ ...formData, contact_number: e.target.value })} />
          </div>

          {/* Email from Auth (read-only info) */}
          <div className='space-y-2'>
            <label className={labelClass}>Email (from your login)</label>
            <input type='email' className={inputClass + ' opacity-60 cursor-not-allowed'} value={email} readOnly />
          </div>

          <button type='submit' disabled={loading}
            className='w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-black uppercase tracking-widest h-14 rounded-2xl shadow-lg shadow-blue-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed'>
            {loading ? 'Finalizing Profile...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
