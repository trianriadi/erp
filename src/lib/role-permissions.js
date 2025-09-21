import React from 'react';

export const modulePermissions = {
  admin: ['finance', 'sales', 'inventory', 'manufacture', 'engineering'],
  finance: ['finance'],
  sales: ['sales'],
  inventory: ['inventory'],
  manufacture: ['manufacture'],
  engineering: ['engineering'],
  production: ['manufacture'],
  viewer: [],
};

export const hasModuleAccess = (role, module) => {
  if (!role || !module) return false;
  if (role === 'admin') return true;
  
  const permissions = modulePermissions[role];
  if (!permissions) return false;

  return permissions.includes(module);
};
