import axios from 'axios'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

request.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err?.response?.data?.error || err.message || '请求失败'
    return Promise.reject(new Error(msg))
  }
)

export const api = {
  getConfig: () => request.get('/config'),
  getStories: () => request.get('/stories'),
  getStory: (id) => request.get(`/stories/${id}`),
  createStory: (data) => request.post('/stories', data),
  addEntry: (id, data) => request.post(`/stories/${id}/entries`, data),
  resetStory: (id) => request.post(`/admin/stories/${id}/reset`),
  diagnose: () => request.get('/admin/diagnose'),
  fixStory: (id) => request.post(`/admin/stories/${id}/fix`),
  fixAllStories: () => request.post('/admin/fix-all')
}

export default api
