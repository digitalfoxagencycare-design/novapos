import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, Phone, Lock, Shield, Check, Trash2, Edit2, Save, UserCheck, AlertCircle } from 'lucide-react';
import {
  type StaffMember,
  PERMISSION_GROUPS,
  FULL_ACCESS_PERMISSIONS,
  CASHIER_PERMISSIONS,
  loadStaffMembers,
  saveStaffMember,
  deleteStaffMember,
} from '../lib/staff';

interface Props {
  phone?: string;
  onBack?: () => void;
}

export const StaffScreen: React.FC<Props> = ({ onBack }) => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formAccessType, setFormAccessType] = useState<'Full Access' | 'Custom Access' | 'Cashier' | 'Manager'>('Full Access');
  const [formPermissions, setFormPermissions] = useState<Record<string, string[]>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = () => {
    const list = loadStaffMembers();
    setStaffList(list);
  };

  const handleOpenAddStaff = () => {
    if (staffList.length >= 2) {
      setErrorMessage('Maximum 2 staff accounts limit reached on your plan.');
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    setSelectedStaff(null);
    setFormName('');
    setFormPhone('');
    setFormPassword('');
    setFormAccessType('Full Access');
    setFormPermissions({ ...FULL_ACCESS_PERMISSIONS });
    setIsEditing(true);
    setErrorMessage(null);
  };

  const handleOpenEditStaff = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setFormName(staff.name);
    setFormPhone(staff.phone);
    setFormPassword(staff.password || '');
    setFormAccessType(staff.accessType);
    setFormPermissions(staff.permissions || { ...FULL_ACCESS_PERMISSIONS });
    setIsEditing(true);
    setErrorMessage(null);
  };

  const handleAccessTypeChange = (type: 'Full Access' | 'Custom Access' | 'Cashier' | 'Manager') => {
    setFormAccessType(type);
    if (type === 'Full Access' || type === 'Manager') {
      setFormPermissions({ ...FULL_ACCESS_PERMISSIONS });
    } else if (type === 'Cashier') {
      setFormPermissions({ ...CASHIER_PERMISSIONS });
    }
  };

  const togglePermission = (groupId: string, option: string) => {
    setFormPermissions((prev) => {
      const current = prev[groupId] || [];
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [groupId]: updated };
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      setErrorMessage('Please provide Staff Name and Phone Number.');
      return;
    }

    const member: StaffMember = {
      id: selectedStaff ? selectedStaff.id : `staff_${Date.now()}`,
      name: formName.trim(),
      phone: formPhone.trim(),
      password: formPassword.trim(),
      accessType: formAccessType,
      permissions: formPermissions,
      createdAt: selectedStaff ? selectedStaff.createdAt : new Date().toISOString(),
    };

    const res = saveStaffMember(member);
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save staff member.');
      return;
    }

    setSuccessMessage(`Staff account for ${member.name} saved successfully!`);
    setTimeout(() => setSuccessMessage(null), 3000);
    setIsEditing(false);
    loadStaff();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to remove this staff account?')) {
      deleteStaffMember(id);
      loadStaff();
      setSuccessMessage('Staff account removed.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  return (
    <div className="ezo-screen-container bg-slate-50 min-h-screen pb-20">
      {/* Top Header */}
      <div className="bg-purple-700 text-white p-4 sticky top-0 z-30 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (isEditing) setIsEditing(false);
              else if (onBack) onBack();
            }}
            className="p-1 text-white hover:bg-purple-800 rounded-full"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold">{isEditing ? (selectedStaff ? 'Edit Staff Member' : 'Add New Staff') : 'Staff Management'}</h1>
            <span className="text-xs text-purple-200">Max 2 Staff accounts ({staffList.length}/2 registered)</span>
          </div>
        </div>

        {!isEditing && staffList.length < 2 && (
          <button
            onClick={handleOpenAddStaff}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staff</span>
          </button>
        )}
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="m-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {!isEditing ? (
          /* Staff List View */
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <b className="text-slate-800 text-sm block">Store Staff Directory</b>
                <p className="text-xs text-slate-500">Provide controlled POS permissions for cashiers and managers</p>
              </div>
              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                {staffList.length} of 2 Active
              </span>
            </div>

            {staffList.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 mx-auto flex items-center justify-center">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">No Staff Accounts Created</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Create up to 2 staff logins to allow your cashiers or helpers to bill orders without giving them full owner access.
                </p>
                <button
                  onClick={handleOpenAddStaff}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-md"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Create First Staff Account</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {staffList.map((staff) => (
                  <div
                    key={staff.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-purple-300 transition-colors cursor-pointer"
                    onClick={() => handleOpenEditStaff(staff)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-base">
                        {staff.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <b className="text-slate-800 text-sm block">{staff.name}</b>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>+91 {staff.phone}</span>
                          <span>•</span>
                          <span className="font-semibold text-purple-700">{staff.accessType}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditStaff(staff);
                        }}
                        className="p-2 text-slate-400 hover:text-purple-700 rounded-lg hover:bg-purple-50"
                        title="Edit Staff"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(staff.id);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Delete Staff"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Staff Add / Edit Form */
          <form onSubmit={handleSave} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            {/* Staff Name */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Staff Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Vijay"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full text-sm font-bold text-slate-800 p-3 border border-slate-200 rounded-xl focus:border-purple-600 outline-none"
              />
            </div>

            {/* Staff Phone */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Staff Phone No *</label>
              <input
                type="tel"
                required
                placeholder="9550249998"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full text-sm font-bold text-slate-800 p-3 border border-slate-200 rounded-xl focus:border-purple-600 outline-none"
              />
            </div>

            {/* Staff Password */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Staff Login PIN / Password</label>
              <input
                type="password"
                placeholder="Set 4-digit PIN or password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                className="w-full text-sm font-semibold text-slate-800 p-3 border border-slate-200 rounded-xl focus:border-purple-600 outline-none"
              />
            </div>

            {/* Select Access Type */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Select Access Type</label>
              <select
                value={formAccessType}
                onChange={(e) => handleAccessTypeChange(e.target.value as any)}
                className="w-full text-sm font-bold text-slate-800 p-3 border border-slate-200 rounded-xl bg-white focus:border-purple-600 outline-none"
              >
                <option value="Full Access">Full Access</option>
                <option value="Cashier">Cashier (Standard Sales & Reports)</option>
                <option value="Manager">Manager</option>
                <option value="Custom Access">Custom Access (Customized Chips)</option>
              </select>
            </div>

            {/* Granular Chip Permissions (18 Groups) */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                Staff Feature Permissions ({PERMISSION_GROUPS.length} Groups)
              </h3>

              {PERMISSION_GROUPS.map((group) => {
                const selectedOptions = formPermissions[group.id] || [];

                return (
                  <div key={group.id} className="space-y-1.5">
                    <span className="text-xs font-bold text-purple-900 block">{group.title}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {group.options.map((opt) => {
                        const isActive = selectedOptions.includes(opt);

                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => togglePermission(group.id, opt)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                              isActive
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-purple-100 text-purple-900 hover:bg-purple-200 border border-purple-200'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Save Button */}
            <div className="pt-4 sticky bottom-4">
              <button
                type="submit"
                className="w-full py-3.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm rounded-full shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                SAVE
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
