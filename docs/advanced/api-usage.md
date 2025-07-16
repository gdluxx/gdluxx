# API Usage

If you have interest in using the API endpoint outside the companion browser
extension, create an API key in the settings, then send `POST` requests to
`https://my-cool-domain.com/api/extension/external`.

### Authentication Methods

You can authenticate with the API using bearer token.

```bash
curl -X POST \
 -H "Authorization: Bearer your-api-key-here" \
 -H "Content-Type: application/json" \
 -d '{"urlToProcess": "https://example.com/image-gallery"}' \
 https://my-cool-domain/api/extension/external
```

### Request Requirements

- **URL Format**: Must be a valid HTTP or HTTPS URL (validated with pattern `/^https?:\/\/.+/`)
- **Content-Type**: Must be `application/json` when sending JSON body
- **Authentication**: API key is required via one of the methods above

### Response Format

A successful request will return a JSON response and queue the job in *gdluxx*:

```json
{
  "success": true,
  "data": {
    "overallSuccess": true,
    "results": [
      {
        "jobId": "generated-job-id",
        "url": "https://example.com/image-gallery",
        "success": true,
        "message": "Job started successfully"
      }
    ]
  },
  "timestamp": "2025-07-16T12:34:56.789Z"
}
```

### Error Handling

If the request fails, you'll receive an error response:

```json
{
  "success": false,
  "error": "Invalid API key",
  "timestamp": "2025-07-16T12:34:56.789Z"
}
```

Common error responses (all return HTTP 500):

- **Invalid API Key**: `"Invalid API key"`
- **Missing API Key**: `"API key is required"`
- **Invalid URL**: URL validation error message
- **Invalid JSON**: `"Invalid request body. Expected valid JSON."`
- **Process Failure**: `"Failed to start process: <details>"`
