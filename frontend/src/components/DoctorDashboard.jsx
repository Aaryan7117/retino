import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function DoctorDashboard() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch patients
  useEffect(() => {
    fetchPatients();
  }, []);

  async function fetchPatients() {
    setLoading(true);

    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setPatients(data);
    }

    setLoading(false);
  }

  // Risk color
  const riskColor = (risk) => {
    if (risk === 'HIGH') return 'text-red-400';
    if (risk === 'MEDIUM') return 'text-orange-400';
    return 'text-emerald-400';
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="section-label">Doctor Portal</p>
        <h1 className="text-4xl font-black text-white">
          Patient Dashboard
        </h1>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading patients...</p>
      ) : patients.length === 0 ? (
        <p className="text-slate-400">No patient data found.</p>
      ) : (
        <div className="grid gap-4">
          {patients.map((p) => (
            <div
              key={p.id}
              className="card-elevated flex justify-between items-center"
            >
              <div>
                <p className="text-white font-bold text-lg">
                  {p.name}
                </p>
                <p className="text-slate-400 text-sm">
                  Age: {p.age} • Gender: {p.gender}
                </p>
              </div>

              <div className="text-right space-y-1">
                <p className="text-white font-bold">
                  Grade {p.grade}
                </p>
                <p className={riskColor(p.risk)}>
                  {p.risk} RISK
                </p>
                <p className="text-xs text-slate-500">
                  {(p.confidence * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}