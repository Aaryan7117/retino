import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

/**
 * DoctorOnboarding — Specialist form for medical professionals.
 * Captures all required Supabase profile columns.
 */
export default function DoctorOnboarding({ userId, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    registration_id: '',
    specialty: 'Ophthalmology',
    hospital_name: '',
    location: '',
    district: '',
    state: '',
    phone: '',
    contact_number: '',
    url: '',
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
        role: 'doctor',
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
      console.error('Onboarding failed:', err);
      setError('Registration failed. Please double-check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full bg-[#0A0F1E] border border-[#1F2937] rounded-xl px-4 py-3 text-white focus:border-violet-500 outline-none transition-all text-sm placeholder:text-slate-600';
  const selectClass = inputClass + ' appearance-none';
  const labelClass = 'text-[10px] font-black text-slate-500 uppercase tracking-widest';

  return (
    <div className='min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center p-6 font-["Outfit"]'>
      <div className='max-w-2xl w-full space-y-10 animate-fade-in'>
        <div className='text-center space-y-3'>
          <h1 className='text-4xl font-black text-white tracking-tighter'>Clinical <span className='text-violet-500'>Credentialing</span></h1>
          <p className='text-slate-500 font-medium'>Please finalize your professional credentials to access clinical screening tools.</p>
        </div>

        {error && (
          <div className='bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-sm font-bold text-center'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='card-elevated bg-[#111827] p-8 md:p-10 space-y-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div className='space-y-2'>
              <label className={labelClass}>Full Legal Name</label>
              <input required type='text' placeholder='Dr. John Doe' className={inputClass}
                value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
            </div>
            <div className='space-y-2'>
              <label className={labelClass}>Age</label>
              <input required type='number' placeholder='Age' className={inputClass}
                value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} />
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div className='space-y-2'>
              <label className={labelClass}>Registration ID (MRN)</label>
              <input required type='text' placeholder='REG-123456' className={inputClass}
                value={formData.registration_id} onChange={e => setFormData({ ...formData, registration_id: e.target.value })} />
            </div>
            <div className='space-y-2'>
              <label className={labelClass}>Primary Specialization</label>
              <select className={selectClass}
                value={formData.specialty} onChange={e => setFormData({ ...formData, specialty: e.target.value })}>
                <option>Ophthalmology</option>
                <option>Optometry</option>
                <option>Diabetology</option>
                <option>General Practice</option>
              </select>
            </div>
          </div>

          <div className='space-y-2'>
            <label className={labelClass}>Clinic / Hospital Name</label>
            <input required type='text' placeholder='City Retina Care Centre' className={inputClass}
              value={formData.hospital_name} onChange={e => setFormData({ ...formData, hospital_name: e.target.value })} />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div className='space-y-2'>
              <label className={labelClass}>City / Location</label>
              <input required type='text' placeholder='Mumbai, India' className={inputClass}
                value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
            </div>
            <div className='space-y-2'>
              <label className={labelClass}>District</label>
              <input type='text' placeholder='Your district' className={inputClass}
                value={formData.district} onChange={e => setFormData({ ...formData, district: e.target.value })} />
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
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

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div className='space-y-2'>
              <label className={labelClass}>Clinic Contact Number</label>
              <input type='tel' placeholder='Clinic phone (optional)' className={inputClass}
                value={formData.contact_number} onChange={e => setFormData({ ...formData, contact_number: e.target.value })} />
            </div>
            <div className='space-y-2'>
              <label className={labelClass}>Website / URL</label>
              <input type='url' placeholder='https://...' className={inputClass}
                value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} />
            </div>
          </div>

          {/* Email from Auth (read-only info) */}
          <div className='space-y-2'>
            <label className={labelClass}>Email (from your login)</label>
            <input type='email' className={inputClass + ' opacity-60 cursor-not-allowed'} value={email} readOnly />
          </div>

          <button type='submit' disabled={loading}
            className='w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-black uppercase tracking-widest h-14 rounded-2xl shadow-lg shadow-violet-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed'>
            {loading ? 'Validating Credentials...' : 'Register as Clinical Expert'}
          </button>
        </form>
      </div>
    </div>
  );
}
