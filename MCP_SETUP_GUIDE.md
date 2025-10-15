# MCP (Model Context Protocol) Setup Guide

This guide explains how to set up and use the MCP integration with Render in your Final10 project.

## What is MCP?

MCP (Model Context Protocol) is a protocol that allows AI models to interact with external tools and services. In this case, we're integrating with Render's MCP service to provide deployment and infrastructure management capabilities.

## Configuration

### 1. API Key Setup

Your Render API key has been configured: `rnd_gfiAGPtzxY8YLb09FL9erD0bbBo8`

**Important Security Note**: For production use, you should:
1. Create a `.env` file in the `server/` directory
2. Add your API key as an environment variable:
   ```
   RENDER_API_KEY=rnd_gfiAGPtzxY8YLb09FL9erD0bbBo8
   ```
3. Never commit the `.env` file to version control

### 2. MCP Configuration File

The MCP configuration is stored in `mcp-config.json` at the project root:

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer rnd_gfiAGPtzxY8YLb09FL9erD0bbBo8"
      }
    }
  }
}
```

## API Endpoints

The following MCP endpoints are now available in your server:

### Test Connection
```
GET /api/mcp/test
```
Tests the connection to Render's MCP service.

### Get Deployment Info
```
GET /api/mcp/deployment/:serviceId
```
Retrieves information about a specific deployment.

### Trigger Deployment
```
POST /api/mcp/deploy/:serviceId
```
Triggers a new deployment for a service.

### Get Service Logs
```
GET /api/mcp/logs/:serviceId
```
Retrieves logs for a specific service.

### Get Service Metrics
```
GET /api/mcp/metrics/:serviceId
```
Retrieves metrics for a specific service.

## Usage Examples

### Testing the Connection
```bash
curl http://localhost:5000/api/mcp/test
```

### Getting Deployment Info
```bash
curl http://localhost:5000/api/mcp/deployment/your-service-id
```

### Triggering a Deployment
```bash
curl -X POST http://localhost:5000/api/mcp/deploy/your-service-id \
  -H "Content-Type: application/json" \
  -d '{"branch": "main"}'
```

## Integration with Your Application

The MCP client is available as a service in your application:

```javascript
const MCPClient = require('./services/mcpClient');
const mcpClient = new MCPClient();

// Test connection
const result = await mcpClient.testConnection();
console.log(result);
```

## Security Considerations

1. **API Key Protection**: Never expose your Render API key in client-side code
2. **Environment Variables**: Use environment variables for sensitive configuration
3. **Rate Limiting**: The MCP endpoints are protected by your existing rate limiting middleware
4. **Authentication**: Consider adding authentication to MCP endpoints if needed

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check if your API key is valid and has the necessary permissions
2. **Service Not Found**: Ensure the service ID is correct
3. **Rate Limited**: Check if you're hitting Render's API rate limits

### Debug Mode

To enable debug logging, set the environment variable:
```
DEBUG=mcp:*
```

## Next Steps

1. Test the connection using the `/api/mcp/test` endpoint
2. Integrate MCP functionality into your application logic
3. Set up monitoring and alerting for deployments
4. Consider adding webhook support for deployment events

## Support

For issues with the MCP integration:
1. Check the server logs for error messages
2. Verify your Render API key permissions
3. Test the connection endpoint first
4. Review Render's MCP documentation for API changes












