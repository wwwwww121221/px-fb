import request from './request';

export const getMyCertificates = () => {
  return request.get('/frontend/certificates/my');
};

export const getPublicCertificates = () => {
  return request.get('/frontend/certificates/public');
};

export const applyPaperCertificate = (id, data) => {
  return request.post(`/frontend/certificates/${id}/requests`, data);
};

export const getMyCertificateRequests = () => {
  return request.get('/frontend/certificates/requests/my');
};

export const getCertificateRequestList = (params) => {
  return request.get('/backend/certificate-requests/list', { params });
};

export const approveCertificateRequest = (id) => {
  return request.put(`/backend/certificate-requests/${id}/approve`);
};

export const rejectCertificateRequest = (id) => {
  return request.put(`/backend/certificate-requests/${id}/reject`);
};

export const shippedCertificateRequest = (id) => {
  return request.put(`/backend/certificate-requests/${id}/shipped`);
};

export const getAdminCertificateList = (params) => {
  return request.get('/backend/certificates/list', { params });
};

export const effectCertificate = (id) => {
  return request.put(`/backend/certificates/${id}/effect`);
};
