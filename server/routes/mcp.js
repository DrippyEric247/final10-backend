/**
 * MCP (Model Context Protocol) Routes
 * API endpoints for Render MCP integration
 */

const express = require('express');
const router = express.Router();
const MCPClient = require('../services/mcpClient');

// Initialize MCP client
const mcpClient = new MCPClient();

/**
 * Test MCP connection
 * GET /api/mcp/test
 */
router.get('/test', async (req, res) => {
  try {
    const result = await mcpClient.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to test MCP connection',
      details: error.message
    });
  }
});

/**
 * Get deployment information
 * GET /api/mcp/deployment/:serviceId
 */
router.get('/deployment/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const result = await mcpClient.getDeployment(serviceId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment info',
      details: error.message
    });
  }
});

/**
 * Trigger a new deployment
 * POST /api/mcp/deploy/:serviceId
 */
router.post('/deploy/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const options = req.body;
    
    const result = await mcpClient.triggerDeployment(serviceId, options);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger deployment',
      details: error.message
    });
  }
});

/**
 * Get service logs
 * GET /api/mcp/logs/:serviceId
 */
router.get('/logs/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const options = req.query;
    
    const result = await mcpClient.getLogs(serviceId, options);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get service logs',
      details: error.message
    });
  }
});

/**
 * Get service metrics
 * GET /api/mcp/metrics/:serviceId
 */
router.get('/metrics/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const result = await mcpClient.getMetrics(serviceId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get service metrics',
      details: error.message
    });
  }
});

module.exports = router;

















