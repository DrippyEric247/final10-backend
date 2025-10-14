import api from './authService';

export const scannerService = {
  // Start the market scanner
  async startScanner() {
    const response = await api.post('/scanner/start');
    return response.data;
  },

  // Stop the market scanner
  async stopScanner() {
    const response = await api.post('/scanner/stop');
    return response.data;
  },

  // Get scanner status
  async getScannerStatus() {
    const response = await api.get('/scanner/status');
    return response.data;
  },

  // Trigger manual scan
  async triggerScan() {
    const response = await api.post('/scanner/scan');
    return response.data;
  },

  // Generate sample auction data
  async generateSampleData() {
    const response = await api.post('/scanner/generate-sample-data');
    return response.data;
  }
};

export default scannerService;
