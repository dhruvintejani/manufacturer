import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Database, Palette, RefreshCw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { PageHeader } from '../components/ui/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

const inputClass = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all";

export const Settings: React.FC = () => {
  const { resetDemoData, profile: savedProfile, setProfile: saveProfile } = useAppStore();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [profile, setProfile] = useState(savedProfile);
  useEffect(() => setProfile(savedProfile), [savedProfile]);
  const handleSaveProfile = () => {
    const name = profile.name.trim();
    const email = profile.email.trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Provide a name and a valid email address.');
      return;
    }
    saveProfile({ name, email, role: profile.role.trim(), phone: profile.phone.trim() });
    toast.success('Demo profile saved in this browser.');
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Settings"
        subtitle="Manage application preferences and demo configuration."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Settings' }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-50 rounded-xl"><User className="w-5 h-5 text-blue-600" /></div>
            <h3 className="text-sm font-semibold text-slate-900">User Profile</h3>
          </div>
          <div className="mb-6 flex min-w-0 flex-wrap items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white text-xl font-bold">AM</span>
            </div>
            <div>
              <div className="break-words text-lg font-bold text-slate-900">{profile.name}</div>
              <div className="text-sm text-slate-500">{profile.role}</div>
              <div className="mt-0.5 break-all text-xs text-slate-400">{profile.email}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Full Name', key: 'name' },
              { label: 'Email Address', key: 'email' },
              { label: 'Role', key: 'role' },
              { label: 'Phone', key: 'phone' },
            ].map(f => (
              <div key={f.key}>
                <label htmlFor={`profile-${f.key}`} className="block text-sm font-medium text-slate-700 mb-1.5">{f.label}</label>
                <input
                  id={`profile-${f.key}`}
                  value={(profile as any)[f.key]}
                  onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button
              onClick={handleSaveProfile}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Save className="w-4 h-4" /> Save Profile
            </button>
          </div>
        </motion.div>

        {/* Demo Actions */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-50 rounded-xl"><Database className="w-5 h-5 text-amber-600" /></div>
              <h3 className="text-sm font-semibold text-slate-900">Demo Data</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Reset the entire browser demo to its original sample state. This restores customers, enquiries, quotations, orders, production jobs, materials, product BOMs, inventory transactions, purchase/restock requests, notifications, activity history, and the demo profile.
            </p>
            <button
              onClick={() => setResetDialogOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Reset Demo Data
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-violet-50 rounded-xl"><Palette className="w-5 h-5 text-violet-600" /></div>
              <h3 className="text-sm font-semibold text-slate-900">App Info</h3>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Version', value: '1.0.0-demo' },
                { label: 'Platform', value: 'ForgeFlow MFG Ops' },
                { label: 'Mode', value: 'Demo / Preview' },
              ].map(i => (
                <div key={i.label} className="flex justify-between text-xs">
                  <span className="text-slate-500">{i.label}</span>
                  <span className="font-medium text-slate-900">{i.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 rounded-xl"><Bell className="w-5 h-5 text-blue-600" /></div>
              <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              Order, enquiry, production, material shortage, low-stock and purchase/restock updates appear in the in-app notification menu.
              Email and desktop push notifications are not connected in this browser-only demo.
            </p>
          </motion.div>
        </div>
      </div>

      <ConfirmDialog
        open={resetDialogOpen}
        title="Reset Demo Data"
        description="This restores all demo records and preferences stored in this browser, including materials, products/BOMs, inventory, purchases, notifications, activity history, and profile data. Any changes you have made will be lost."
        confirmLabel="Reset Data"
        variant="warning"
        onConfirm={() => {
          resetDemoData();
          setResetDialogOpen(false);
          toast.success('Demo data reset successfully!');
        }}
        onCancel={() => setResetDialogOpen(false)}
      />
    </div>
  );
};
