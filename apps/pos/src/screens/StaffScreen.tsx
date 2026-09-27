import React, { useState } from 'react';
import {
  ArrowLeft,
  Users,
  Plus,
  Trash2,
  Edit2,
  Check,
  Shield,
  Phone,
  Lock,
  UserCheck,
  AlertTriangle,
  Save,
} from 'lucide-react';
import {
  StaffMember,
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

export const StaffScreen: React.FC<Props> = ({ phone = '9848787308', onBack }) => {
  const [staffList, setStaffList] = useState<StaffMember[]>(loadStaffMembers());
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formAccessType, setFormAccessType] = useState<'Full Access' | 'Custom Access' | 'Cashier' | 'Manager'>('Full Access');
  const [formPermissions, setFormPermissions] = useState<Record<string, string[]>>(FULL_ACCESS_PERMISSIONS);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refreshList = () => {
    const list = loadStaffMembers();
    setStaffList(list);
  };

  const handleOpenNewStaff = () => {
    if (staffList.length >= 2) {
      setStatusMessage({
        type: 'error',
        text: 'Maximum 2 Staff accounts limit reached for this store license. Please edit an existing staff or delete one.',
      });
      return;
    }

    setSelectedStaff(null);
    setFormName('');
    setFormPhone('');
    setFormPassword('');
    setFormAccessType('Full Access');
    setFormPermissions(FULL_ACCESS_PERMISSIONS);
    setIsEditing(true);
    setStatusMessage(null);
  };

  const handleOpenEditStaff = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setFormName(staff.name);
    setFormPhone(staff.phone);
    setFormPassword(staff.password || '');
    setFormAccessType(staff.accessType);
    setFormPermissions(staff.permissions || FULL_ACCESS_PERMISSIONS);
    setIsEditing(true);
    setStatusMessage(null);
  };

  const handleAccessTypeChange = (type: 'Full Access' | 'Custom Access' | 'Cashier' | 'Manager') => {
    setFormAccessType(type);
    if (type === 'Full Access' || type === 'Manager') {
      setFormPermissions(FULL_ACCESS_PERMISSIONS);
    } else if (type === 'Cashier') {
      setFormPermissions(CASHIER_PERMISSIONS);
    }
  };

  const togglePermission = (groupId: string, option: string) => {
    const current = formPermissions[groupId] || [];
    const updated = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];

    setFormPermissions({
      ...formPermissions,
      [groupId]: updated,
    });
    setFormAccessType('Custom Access');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter staff name and phone number.' });
      return;
    }

    const member: StaffMember = {
      id: selectedStaff ? selectedStaff.id : `staff-${Date.now()}`,
      name: formName.trim(),
      phone: formPhone.trim(),
      password: formPassword.trim() || undefined,
      accessType: formAccessType,
      permissions: formPermissions,
      createdAt: selectedStaff ? selectedStaff.createdAt : new Date().toISOString(),
    };

    const res = saveStaffMember(member);
    if (res.success) {
      refreshList();
      setIsEditing(false);
      setSelectedStaff(null);
      setStatusMessage({ type: 'success', text: 'Staff account saved successfully!' });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to save staff.' });
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this staff account?')) return;
    deleteStaffMember(id);
    refreshList();
    if (selectedStaff?.id === id) {
      setIsEditing(false);
      setSelectedStaff(null);
    }
  };

  return (
    <div className="ezo-screen-container bg-slate-100 min-h-screen">
      {/* Top Purple App Bar matching Screenshot 4 */}
      <div className="ezo-app-bar bg-purple-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button
            className="ezo-back-btn p-1 rounded-full hover:bg-purple-800"
            onClick={() => {
              if (isEditing) setIsEditing(false);
              else if (onBack) onBack();
            }}
            title="Back"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div className="ezo-title-group">
            <h1 className="text-lg font-bold">Staff</h1>
            <span className="text-[11px] text-purple-200">FAST v39.34 | {phone} | 6231</span>
          </div>
        </div>

        {isEditing && selectedStaff && (
          <button
            onClick={() => handleDelete(selectedStaff.id)}
            className="p-1.5 text-purple-200 hover:text-white hover:bg-purple-800 rounded-lg"
            title="Delete Staff"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {!isEditing ? (
          /* Staff List View */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Staff Accounts ({staffList.length}/2)</h2>
                <p className="text-xs text-slate-500">Each store license supports up to 2 staff logins.</p>
              </div>

              {staffList.length < 2 && (
                <button
                  onClick={handleOpenNewStaff}
                  className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Staff
                </button>
              )}
            </div>

            <div className="space-y-3">
              {staffList.map((staff) => (
                <div
                  key={staff.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-purple-300 transition-all cursor-pointer"
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
          </div>
        ) : (
          /* Staff Add / Edit Form matching Screenshot 4 */
          <form onSubmit={handleSave} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            {/* Staff Name */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Staff Name</label>
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
              <label className="text-xs font-semibold text-slate-600 block mb-1">Staff Phone No</label>
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

            {/* Granular Chip Permissions matching Screenshot 4 */}
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

            {/* Bottom Save Button matching Screenshot 4 */}
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
