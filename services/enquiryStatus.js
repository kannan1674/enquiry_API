export const ENQUIRY_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
  { value: 'lost', label: 'Lost' },
];

export const ENQUIRY_STATUS_VALUES = ENQUIRY_STATUSES.map((item) => item.value);

export const ENQUIRY_STATUS_EDITOR_ROLES = ['agency_super_admin', 'direct_owner'];

export function statusLabel(value) {
  return ENQUIRY_STATUSES.find((item) => item.value === value)?.label || value || 'Open';
}

export function isValidEnquiryStatus(value) {
  return ENQUIRY_STATUS_VALUES.includes(String(value || '').trim());
}

export function canEditEnquiryStatus(user, enquiry = null) {
  if (!user || !ENQUIRY_STATUS_EDITOR_ROLES.includes(user.role)) {
    return false;
  }
  if (user.role === 'agency_super_admin') {
    return true;
  }
  if (!enquiry) {
    return true;
  }
  return Number(user.tenantId) === Number(enquiry.tenantId);
}
