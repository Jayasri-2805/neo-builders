import axiosClient from './axiosClient';

export function createMasterApi(endpoint) {
  return {
    list: (params) => axiosClient.get(`/${endpoint}`, { params }),
    listAll: () => axiosClient.get(`/${endpoint}/all`),
    getOne: (id) => axiosClient.get(`/${endpoint}/${id}`),
    create: (payload) => axiosClient.post(`/${endpoint}`, payload),
    update: (id, payload) => axiosClient.put(`/${endpoint}/${id}`, payload),
    updateStatus: (id, status) => axiosClient.patch(`/${endpoint}/${id}/status`, { status }),
    remove: (id) => axiosClient.delete(`/${endpoint}/${id}`),
  };
}

export const dashboardApi = {
  getStats: () => axiosClient.get('/dashboard/stats'),
};

export const companyApi = {
  getProfile: () => axiosClient.get('/company/profile'),
  updateProfile: (payload) => axiosClient.put('/company/profile', payload),
  uploadLogo: (formData) => axiosClient.post('/company/profile/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  dismissPrompt: () => axiosClient.post('/company/profile/dismiss-prompt'),
};

export const userApi = createMasterApi('users');
export const materialRequestApi = createMasterApi('material-requests');
export const purchaseIndentApi = createMasterApi('purchase-indents');
export const productTypeApi = createMasterApi('product-types');
export const itemCategoryApi = createMasterApi('item-categories');
export const itemUomApi = createMasterApi('item-uoms');
export const taxApi = createMasterApi('taxes');
export const itemApi = createMasterApi('items');
export const supplierApi = createMasterApi('suppliers');
export const quotationApi = createMasterApi('quotations');
export const comparisonApi = {
  sendForMdApproval: (materialRequestId) => axiosClient.post('/comparison/send-md-approval', { materialRequestId }),
  mdApprove: (materialRequestId, payload) => axiosClient.post('/comparison/md-approve', { materialRequestId, ...payload }),
  mdReject: (materialRequestId, payload) => axiosClient.post('/comparison/md-reject', { materialRequestId, ...payload }),
};

export const purchaseOrderApi = (() => {
  const api = createMasterApi('purchase-orders');
  return {
    ...api,
    generate: (payload) => axiosClient.post('/purchase-orders/generate', payload),
    getPdf: (id) => axiosClient.get(`/purchase-orders/${id}/pdf`),
  };
})();

export const uploadAttachment = (formData) => axiosClient.post('/upload-attachment', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const roleApi = {
  list: () => axiosClient.get('/roles'),
  getOne: (id) => axiosClient.get(`/roles/${id}`),
  create: (payload) => axiosClient.post('/roles', payload),
  update: (id, payload) => axiosClient.put(`/roles/${id}`, payload),
  remove: (id) => axiosClient.delete(`/roles/${id}`),
};
export const auditLogApi = {
  list: (params) => axiosClient.get('/audit-logs', { params }),
};
