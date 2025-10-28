/**
 * MCP (Model Context Protocol) Client for Render Integration
 * This service handles communication with Render's MCP service
 */

const axios = require('axios');

class MCPClient {
  constructor() {
    this.apiKey = process.env.RENDER_API_KEY || 'rnd_gfiAGPtzxY8YLb09FL9erD0bbBo8';
    this.baseURL = 'https://mcp.render.com/mcp';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Test the MCP connection
   * @returns {Promise<Object>} Connection status
   */
  async testConnection() {
    try {
      const response = await this.client.get('/health');
      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  /**
   * Get deployment information
   * @param {string} serviceId - Render service ID
   * @returns {Promise<Object>} Deployment info
   */
  async getDeployment(serviceId) {
    try {
      const response = await this.client.get(`/deployments/${serviceId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Trigger a new deployment
   * @param {string} serviceId - Render service ID
   * @param {Object} options - Deployment options
   * @returns {Promise<Object>} Deployment result
   */
  async triggerDeployment(serviceId, options = {}) {
    try {
      const response = await this.client.post(`/deployments/${serviceId}`, options);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get service logs
   * @param {string} serviceId - Render service ID
   * @param {Object} options - Log options
   * @returns {Promise<Object>} Service logs
   */
  async getLogs(serviceId, options = {}) {
    try {
      const response = await this.client.get(`/services/${serviceId}/logs`, {
        params: options
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get service metrics
   * @param {string} serviceId - Render service ID
   * @returns {Promise<Object>} Service metrics
   */
  async getMetrics(serviceId) {
    try {
      const response = await this.client.get(`/services/${serviceId}/metrics`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = MCPClient;

















