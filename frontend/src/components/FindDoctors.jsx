import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Doctor pin — violet glow pulse
const doctorMarkerIcon = L.divIcon({
    html: `<div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(139,92,246,0.25);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:#7c3aed;border:2.5px solid #fff;box-shadow:0 0 12px rgba(139,92,246,0.8);"></div>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
});

// User "You are here" pin — blue glow pulse
const userMarkerIcon = L.divIcon({
    html: `<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(59,130,246,0.2);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="position:absolute;width:24px;height:24px;border-radius:50%;background:rgba(59,130,246,0.15);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;animation-delay:0.5s;"></div>
        <div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 16px rgba(59,130,246,0.9), 0 0 40px rgba(59,130,246,0.4);"></div>
    </div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22]
});

// Auto-fit map to show all markers
function FitBounds({ doctors, userPos }) {
    const map = useMap();
    useEffect(() => {
        const points = [];
        if (userPos) points.push(userPos);
        doctors.forEach(d => {
            if (d.lat && d.lng) points.push([d.lat, d.lng]);
        });
        if (points.length > 1) {
            map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 12 });
        } else if (points.length === 1) {
            map.setView(points[0], 10);
        }
    }, [doctors, userPos, map]);
    return null;
}

/**
 * FindDoctors — Discovery portal with live map showing your location + doctor locations.
 */
export default function FindDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userPos, setUserPos] = useState(null);
  const [locationStatus, setLocationStatus] = useState('detecting');

  // Get user's live GPS location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setLocationStatus('found');
      },
      (err) => {
        console.warn('Geolocation failed:', err.message);
        setLocationStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    async function fetchDoctors() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'doctor')
          .eq('profile_complete', true);

        if (error) throw error;
        
        const docs = data || [];
        const geocodedDocs = [];
        
        for (const doc of docs) {
            let processedDoc = { ...doc };
            if (doc.district || doc.state || doc.location) {
                const queryStr = `${doc.district || doc.location || ''},${doc.state || ''},India`
                  .replace(/^,+|,+$/g, '')
                  .replace(/,+/g, ',');
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&format=json`);
                    const geo = await res.json();
                    if (geo && geo.length > 0) {
                        processedDoc = { ...doc, lat: parseFloat(geo[0].lat), lng: parseFloat(geo[0].lon) };
                    }
                } catch(e) { console.error("Geocoding err", e); }
            }
            geocodedDocs.push(processedDoc);
        }

        setDoctors(geocodedDocs);
      } catch (e) {
        console.error('Failed to fetch experts:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchDoctors();
  }, []);

  const filteredDoctors = doctors.filter(d => 
    (d.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.specialty || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.location || '').toLowerCase().includes(search.toLowerCase())
  );
  
  const mapCenter = userPos || [13.0827, 80.2707];

  return (
    <div className='max-w-6xl mx-auto space-y-10 font-["Outfit"] pb-24 animate-fade-in relative pt-12'>
      {/* Back Button */}
      <button onClick={() => window.history.back()} className="absolute top-0 left-0 flex items-center justify-center w-10 h-10 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400 hover:bg-violet-600 hover:text-white transition-all group shrink-0 z-10">
        <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
      </button>
      
      <div className='flex flex-col md:flex-row md:items-end justify-between gap-6'>
        <div>
          <p className='section-label'>Expert Network</p>
          <h1 className='text-4xl md:text-5xl font-black text-white tracking-tighter leading-none'>Find Clinical Experts</h1>
          <p className='text-slate-500 mt-4 max-w-lg'>Connect with verified ophthalmologists and diagnostic specialists on the platform.</p>
        </div>

        <div className='relative group z-10'>
          <div className='absolute inset-y-0 left-4 flex items-center pointer-events-none'>
            <svg className="w-5 h-5 text-slate-500 group-focus-within:text-violet-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name, specialty, or city..."
            className='w-full md:w-80 bg-[#111827] border border-[#1F2937] rounded-3xl pl-12 pr-6 py-4 text-white focus:border-violet-500/50 outline-none transition-all shadow-xl'
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Location Status Bar */}
      <div className="flex items-center gap-3">
        {locationStatus === 'found' && (
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Your location detected
          </span>
        )}
        {locationStatus === 'detecting' && (
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">
            <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            Detecting your location...
          </span>
        )}
        {locationStatus === 'denied' && (
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Location access denied — Enable GPS for distance info
          </span>
        )}
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-violet-500"></span>
          {doctors.filter(d => d.lat && d.lng).length} doctors on map
        </span>
      </div>
      
      {/* MAP VIEW */}
      {!loading && (
        <div className="w-full rounded-[32px] overflow-hidden shadow-2xl shadow-violet-900/10 border border-[#1F2937] z-0 h-[300px] md:h-[450px] relative isolate">
          <MapContainer center={mapCenter} zoom={7} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            {/* Base dark map — shows roads, labels, cities at ALL zoom levels */}
            <TileLayer 
               url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
               attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
               maxZoom={19}
            />

            {/* Auto-fit bounds */}
            <FitBounds doctors={doctors} userPos={userPos} />

            {/* YOUR location — blue pulsing dot */}
            {userPos && (
              <Marker position={userPos} icon={userMarkerIcon}>
                <Popup>
                  <div className="font-['Outfit'] -m-1 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                      <p className="text-sm font-black text-blue-600 leading-none">You are here</p>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold">Your current location</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Doctor locations — violet pulsing dots */}
            {doctors.filter(d => d.lat && d.lng).map(doctor => (
               <Marker key={`map-${doctor.id}`} position={[doctor.lat, doctor.lng]} icon={doctorMarkerIcon}>
                 <Popup>
                    <div className="font-['Outfit'] -m-1" style={{ minWidth: '180px' }}>
                        <p className="text-sm font-black mb-0.5 leading-tight text-slate-900">{doctor.full_name}</p>
                        <p className="text-[10px] text-violet-600 font-bold uppercase tracking-widest mb-2">{doctor.specialty || 'Ophthalmologist'}</p>
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold mb-3">
                          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          <span className="truncate">{doctor.hospital_name || doctor.location || 'Clinic'}</span>
                        </div>
                        <button 
                           onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${doctor.lat},${doctor.lng}`)}
                           style={{ width: '100%', background: '#7c3aed', color: '#fff', fontSize: '9px', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.15em', padding: '8px 0', borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,58,237,0.4)' }}
                        >
                           Get Directions
                        </button>
                    </div>
                 </Popup>
               </Marker>
            ))}
          </MapContainer>
          
          {/* Map Legend overlay */}
          <div className="absolute bottom-4 left-4 z-[20] flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#0A0F1E]/90 backdrop-blur-md border border-[#1F2937]">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-[0_0_6px_rgba(59,130,246,0.6)]"></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">You</span>
            </div>
            <div className="w-px h-4 bg-[#1F2937]"></div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-violet-600 border-2 border-white shadow-[0_0_6px_rgba(139,92,246,0.6)]"></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Doctors</span>
            </div>
          </div>

          <style>{`
            @keyframes ping {
              75%, 100% { transform: scale(2); opacity: 0; }
            }
            .leaflet-container {
                background: #0A0F1E;
                font-family: 'Outfit', sans-serif;
                z-index: 1 !important;
            }
            .leaflet-top, .leaflet-bottom {
                z-index: 10 !important;
            }
            .leaflet-popup-content-wrapper {
                background: #ffffff;
                border-radius: 20px;
                box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
            }
            .leaflet-popup-tip {
                background: #ffffff;
            }
            .leaflet-popup-close-button {
                color: #64748B !important;
                padding: 6px 6px 0 0 !important;
            }
            .leaflet-control-zoom {
                border: none !important;
                box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
            }
            .leaflet-control-zoom a {
                background: #111827 !important;
                color: #94a3b8 !important;
                border: 1px solid #1F2937 !important;
                width: 36px !important;
                height: 36px !important;
                line-height: 36px !important;
                font-size: 16px !important;
            }
            .leaflet-control-zoom a:hover {
                background: #1F2937 !important;
                color: #fff !important;
            }
          `}</style>
        </div>
      )}

      {loading ? (
        <div className='flex flex-col items-center justify-center p-20 space-y-4'>
          <div className='w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin' />
          <p className='text-[10px] font-black text-slate-500 uppercase tracking-widest'>Accessing Medical Directory...</p>
        </div>
      ) : filteredDoctors.length > 0 ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4'>
          {filteredDoctors.map(doctor => (
            <div key={doctor.id} className='bg-[#111827] border border-[#1F2937] rounded-3xl group hover:border-violet-500/40 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)] transition-all p-6 relative flex flex-col justify-between'>
               
               <div>
                 <div className='flex items-center gap-4 mb-5 border-b border-[#1F2937] pb-5'>
                    {doctor.avatar_url ? (
                      <img src={doctor.avatar_url} alt={doctor.full_name} className='w-[70px] h-[70px] rounded-2xl object-cover shrink-0 shadow-lg border border-violet-500/20' />
                    ) : (
                      <div className='w-[70px] h-[70px] rounded-2xl bg-gradient-to-br from-violet-900/40 to-[#0A0F1E] border border-violet-500/20 flex items-center justify-center shrink-0 shadow-lg'>
                        <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                    )}
                    
                    <div className='space-y-0.5 flex-1'>
                      <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">
                         <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                         Certified Member
                      </div>
                      <h3 className='text-[19px] leading-tight font-black text-white group-hover:text-violet-300 transition-colors line-clamp-1'>
                         {doctor.full_name}
                      </h3>
                      <p className='text-slate-400 font-medium text-xs'>{doctor.specialty || 'General Specialist'}</p>
                    </div>
                 </div>

                 <div className="flex items-center justify-between mb-5">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-sm text-white font-bold">
                            <span className="text-amber-400">★ 4.9</span>
                            <span className="text-slate-500 text-xs font-medium">(243)</span>
                        </div>
                        <div className="text-[10px] uppercase font-black tracking-widest text-slate-500">Reviews</div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Available Remotely
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                           <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                           {doctor.location || 'Undisclosed'}
                        </div>
                    </div>
                 </div>
               </div>

               <button 
                 onClick={() => {
                   if(doctor.contact_number) window.location.href = `tel:${doctor.contact_number}`;
                   else if(doctor.email) window.location.href = `mailto:${doctor.email}`;
                   else alert('Contact information is currently unavailable for this specialist.');
                 }}
                 className='w-full py-4 rounded-2xl bg-violet-600 text-white text-sm font-black transition-all hover:bg-violet-700 shadow-xl shadow-violet-600/30 flex items-center justify-center gap-2 group-hover:scale-[1.02]'>
                 Book Consultation 
                 <svg className="w-4 h-4 opacity-50 font-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
               </button>
            </div>
          ))}
        </div>
      ) : (
        <div className='bg-[#111827] border border-[#1F2937] rounded-3xl flex flex-col items-center justify-center p-20 text-center space-y-6'>
           <div className='text-6xl grayscale opacity-20'>🔍</div>
           <div className='space-y-2'>
              <h3 className='text-2xl font-black text-white'>No Experts Discovered</h3>
              <p className='text-slate-500 max-w-sm'>No doctors registered yet. Doctors can register at sightsheild-ai-zvn7.vercel.app</p>
           </div>
           <button onClick={() => setSearch('')} className='text-violet-500 font-bold uppercase text-[10px] tracking-widest border-b border-violet-500 pb-0.5'>Clear Selection</button>
        </div>
      )}
    </div>
  );
}
