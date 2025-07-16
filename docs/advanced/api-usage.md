# API Usage

If you have interest in using the API endpoint outside the companion browser
extension, create an API key in the settings, then send `POST` requests to
`https://my-cool-domain.com/api/extension/external`.

### Authentication

The API uses Bearer token authentication exclusively:

```bash
curl -X POST \
 -H "Authorization: Bearer your-api-key-here" \
 -H "Content-Type: application/json" \
 -d '{"urlToProcess": "https://example.com/image-gallery"}' \
 https://my-cool-domain/api/extension/external
```

### Request Requirements

- **Authorization Header**: Must include `Authorization: Bearer <api-key>`
- **URL Format**: Must be a valid HTTP or HTTPS URL (validated with pattern `/^https?:\/\/.+/`)
- **Content-Type**: Must be `application/json`

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

- **Missing Authorization Header**: `"Authorization header with Bearer token is required"`
- **Empty Bearer Token**: `"Bearer token cannot be empty"`
- **Invalid API Key**: `"Invalid API key"`
- **Invalid URL**: URL validation error message
- **Invalid JSON**: `"Invalid request body. Expected valid JSON."`
- **Process Failure**: `"Failed to start process: <details>"`
