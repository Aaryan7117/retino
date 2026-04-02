import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

/**
 * ProfilePage — Unified identity management with profile picture.
 */
export default function ProfilePage({ userId, profile, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [uploading, setUploading] = useState(false);
  const [email, setEmail] = useState('');

  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    age: profile?.age || '',
    gender: profile?.gender || 'Male',
    location: profile?.location || '',
    district: profile?.district || '',
    state: profile?.state || '',
    phone: profile?.phone || '',
    contact_number: profile?.contact_number || '',
    registration_id: profile?.registration_id || '',
    specialty: profile?.specialty || '',
    hospital_name: profile?.hospital_name || '',
    diabetic_history: profile?.diabetic_history || 'No',
    url: profile?.url || '',
  });

  const [initialData, setInitialData] = useState(formData);
  const [initialAvatar, setInitialAvatar] = useState(avatarUrl);
  const isChanged = JSON.stringify(formData) !== JSON.stringify(initialData) || avatarUrl !== initialAvatar;

  // Fetch auth email
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email);
    });
  }, []);

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `avatars/${userId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl + '?t=' + Date.now();
      setAvatarUrl(publicUrl);

      // Save avatar_url in profile
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
    } catch (err) {
      console.error('Avatar upload failed:', err);
      setMsg({ type: 'error', text: 'Failed to upload photo. Check Supabase storage bucket.' });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const payload = {
        ...formData,
        age: formData.age || null,
        email: email,
        updated_at: new Date().toISOString(),
      };
      if (avatarUrl) payload.avatar_url = avatarUrl;

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      if (onUpdate) onUpdate(data);
      setInitialData(formData);
      setInitialAvatar(avatarUrl);
      setMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      console.error('Update failed:', err);
      setMsg({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("WARNING: Are you absolutely sure you want to delete your account? This action cannot be undone.")) {
      const confirmText = window.prompt("Type 'delete' to verify full account deletion:");
      if (confirmText?.toLowerCase() === 'delete') {
         setLoading(true);
         try {
           // Delete profile row (which manages all patient linkage and roles natively)
           await supabase.from('profiles').delete().eq('id', userId);
           
           // Clear IndexedDB completely
           const dbName = `RetinaScanDB_${userId}`;
           window.indexedDB.deleteDatabase(dbName);
           window.indexedDB.deleteDatabase('RetinaScanDB');
           
           // Sign out from Supabase which naturally redirects to Auth
           await supabase.auth.signOut();
           window.location.href = '/';
         } catch (err) {
           console.error(err);
           setMsg({ type: 'error', text: 'Failed to delete account. Please contact support.' });
           setLoading(false);
         }
      } else {
         alert("Deletion cancelled. Text did not match 'delete'.");
      }
    }
  };

  const inputClass = 'w-full bg-[#0A0F1E] border border-[#1F2937] text-white rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all';
  const selectClass = inputClass + ' appearance-none';
  const labelClass = 'text-[10px] font-black text-slate-500 uppercase tracking-widest';

  return (
    <div className='max-w-4xl mx-auto space-y-10 font-["Outfit"] pb-24 animate-fade-in relative pt-12'>
      {/* Back Button */}
      <button onClick={() => window.history.back()} className="absolute top-0 left-0 flex items-center justify-center w-10 h-10 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400 hover:bg-violet-600 hover:text-white transition-all group shrink-0 z-10">
        <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
      </button>
      
      <div className='flex flex-col md:flex-row md:items-end justify-between gap-6'>
        <div>
          <p className='section-label'>Identity Management</p>
          <h1 className='text-4xl md:text-5xl font-black text-white tracking-tighter leading-none'>My Profile</h1>
          <p className='text-slate-500 mt-4 max-w-lg'>Manage your personal and professional profile details for clinical screening.</p>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-2xl text-sm font-bold text-center border animate-fade-in ${
          msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleUpdate} className='card-elevated bg-[#111827] p-8 md:p-10 space-y-10'>
        {/* Avatar + Role Badge */}
        <div className='flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-[#0A0F1E] border border-[#1F2937]'>
          {/* Avatar */}
          <div className='relative group'>
            <div className='w-24 h-24 rounded-2xl overflow-hidden border-2 border-violet-500/30 bg-gradient-to-br from-violet-600/30 to-blue-600/30 flex items-center justify-center shadow-lg shadow-violet-500/10'>
              {avatarUrl ? (
                <img src={avatarUrl} alt='Profile' className='w-full h-full object-cover' />
              ) : (
                <span className='text-3xl font-black text-white/80'>{getInitials(formData.full_name)}</span>
              )}
            </div>
            <label className='absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity'>
              <input type='file' accept='image/*' className='hidden' onChange={handleAvatarUpload} disabled={uploading} />
              {uploading ? (
                <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
              ) : (
                <svg className='w-6 h-6 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' />
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 13a3 3 0 11-6 0 3 3 0 016 0z' />
                </svg>
              )}
            </label>
          </div>

          <div className='text-center sm:text-left flex-1'>
            <p className='text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none'>Account Role</p>
            <p className='text-white font-black uppercase text-lg mt-1 tracking-widest'>{profile?.role || 'User'}</p>
            <p className='text-slate-500 text-xs mt-2 font-medium'>{email}</p>
            <p className='text-slate-600 text-[10px] mt-1'>Hover on photo to upload</p>
          </div>
        </div>

        {/* Form Fields */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {/* ───── COMMON FIELDS ───── */}
          <div className='space-y-2'>
            <label className={labelClass}>Full Name</label>
            <input required type='text' className={inputClass} placeholder='Your full name'
              value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
          </div>
          <div className='space-y-2'>
            <label className={labelClass}>Email Address</label>
            <input type='email' className={inputClass + ' opacity-60 cursor-not-allowed'} value={email} readOnly title='Email is managed via authentication' />
          </div>
          <div className='space-y-2'>
            <label className={labelClass}>Phone Number</label>
            <input type='tel' className={inputClass} placeholder='91-XXXXXXXXXX'
              value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div className='space-y-2'>
            <label className={labelClass}>City / Location</label>
            <input type='text' className={inputClass} placeholder='Chennai, India'
              value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
          </div>
          <div className='space-y-2'>
            <label className={labelClass}>District</label>
            <input type='text' className={inputClass} placeholder='Your district'
              value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} />
          </div>
          <div className='space-y-2'>
            <label className={labelClass}>State</label>
            <input type='text' className={inputClass} placeholder='Tamil Nadu'
              value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
          </div>

          {/* ───── DOCTOR SPECIFIC ───── */}
          {profile?.role === 'doctor' && (
            <>
              <div className='space-y-2'>
                <label className={labelClass}>Age</label>
                <input type='number' className={inputClass} placeholder='Age'
                  value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
              </div>
              <div className='space-y-2'>
                <label className={labelClass}>Registration ID (MRN)</label>
                <input type='text' className={inputClass} placeholder='REG-123456'
                  value={formData.registration_id} onChange={e => setFormData({...formData, registration_id: e.target.value})} />
              </div>
              <div className='space-y-2'>
                <label className={labelClass}>Specialty</label>
                <select className={selectClass}
                  value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})}>
                  <option>Ophthalmology</option>
                  <option>Optometry</option>
                  <option>Diabetology</option>
                  <option>General Practice</option>
                </select>
              </div>
              <div className='space-y-2'>
                <label className={labelClass}>Clinic / Hospital</label>
                <input type='text' className={inputClass} placeholder='City Retina Care Centre'
                  value={formData.hospital_name} onChange={e => setFormData({...formData, hospital_name: e.target.value})} />
              </div>
              <div className='space-y-2'>
                <label className={labelClass}>Contact Number (Clinic)</label>
                <input type='tel' className={inputClass} placeholder='91-XXXXXXXXXX'
                  value={formData.contact_number} onChange={e => setFormData({...formData, contact_number: e.target.value})} />
              </div>
              <div className='space-y-2'>
                <label className={labelClass}>Website / URL</label>
                <input type='url' className={inputClass} placeholder='https://...'
                  value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} />
              </div>
            </>
          )}

          {/* ───── PATIENT SPECIFIC ───── */}
          {profile?.role === 'patient' && (
            <>
              <div className='space-y-2'>
                <label className={labelClass}>Age</label>
                <input type='number' className={inputClass} placeholder='Age'
                  value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
              </div>
              <div className='space-y-2'>
                <label className={labelClass}>Gender</label>
                <select className={selectClass}
                  value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div className='space-y-2'>
                <label className={labelClass}>Contact Number</label>
                <input type='tel' className={inputClass} placeholder='91-XXXXXXXXXX'
                  value={formData.contact_number} onChange={e => setFormData({...formData, contact_number: e.target.value})} />
              </div>
              <div className='space-y-2 md:col-span-2'>
                <label className={labelClass}>Diabetic History</label>
                <select className={selectClass}
                  value={formData.diabetic_history} onChange={e => setFormData({...formData, diabetic_history: e.target.value})}>
                  <option>No</option>
                  <option>Yes, Type-1</option>
                  <option>Yes, Type-2</option>
                  <option>Gestational</option>
                  <option>Unknown</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div className='pt-6'>
          <button type='submit' disabled={loading || !isChanged} className={isChanged ? 'w-full btn-primary bg-violet-600 hover:bg-violet-500 text-white font-black h-14 animate-pulse ring-4 ring-violet-500/50 transition-all shadow-[0_0_20px_rgba(139,92,246,0.5)]' : 'w-full bg-[#050811] border border-[#1F2937] text-slate-500 font-black h-14 rounded-2xl transition-all'}>
            {loading ? 'Committing Changes...' : 'Save Profile'}
          </button>
          
          <button type='button' onClick={handleDeleteAccount} disabled={loading} className='w-full mt-4 py-4 rounded-xl border border-red-500/30 text-red-500 font-black uppercase tracking-widest text-[10px] hover:bg-red-500/10 hover:border-red-500/50 transition-all'>
            Delete Account
          </button>
        </div>
      </form>
    </div>
  );
}
