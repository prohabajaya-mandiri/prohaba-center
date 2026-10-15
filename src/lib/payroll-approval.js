const transitions = {
  SUBMIT: { role: 'HRD', from: 'DRAFT', to: 'SUBMITTED', step: 1 },
  HRD_APPROVE: { role: 'HRD', from: 'SUBMITTED', to: 'HRD_APPROVED', step: 2 },
  FINANCE_APPROVE: { role: 'FINANCE', from: 'HRD_APPROVED', to: 'FINANCE_APPROVED', step: 3 },
  TOP_APPROVE: { role: 'TOP_MANAGEMENT', from: 'FINANCE_APPROVED', to: 'APPROVED', step: 4 },
};
export function payrollTransition(role, action) {
  const transition = Object.hasOwn(transitions, action) ? transitions[action] : null;
  return transition && (role === transition.role || role === 'TOP_MANAGEMENT') ? transition : null;
}
