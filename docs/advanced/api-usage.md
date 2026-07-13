# API Usage

The gdluxx API lets you send download jobs from anywhere—scripts, applications,
mobile apps, etc.

## Getting Started

### Step 1: Create an API Key

1. In gdluxx, go to **Settings > API Key Manager**
2. Click **Create New Key**
3. Give it a name (e.g., "My Script")
4. Click **Create**
5. **Copy the key immediately** - you won't see it again

### Step 2: Send a Request

Use your API key to send URLs to the `/api/extension/external` endpoint:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"urlToProcess": "https://example.com/gallery"}' \
  https://your-gdluxx-url/api/extension/external
```

Replace:

- `YOUR_API_KEY` with your actual key
- `https://your-gdluxx-url` with your gdluxx server address

## Sending Single URLs

### Basic Request

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"urlToProcess": "https://example.com"}' \
  https://localhost:7755/api/extension/external
```

### Success Response

```json
{
  "success": true,
  "data": {
    "overallSuccess": true,
    "results": [
      {
        "url": "https://example.com",
        "jobId": "abc123xyz",
        "success": true,
        "message": "Job started successfully"
      }
    ]
  }
}
```

The `jobId` lets you track the job in gdluxx.

## Batch Processing (Multiple URLs)

Send multiple URLs in a single request:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example.com/gallery1",
      "https://example.com/gallery2",
      "https://example.com/gallery3"
    ]
  }' \
  https://localhost:7755/api/extension/external
```

### Batch Response

```json
{
  "success": true,
  "data": {
    "overallSuccess": true,
    "results": [
      {
        "url": "https://example.com/gallery1",
        "jobId": "job1",
        "success": true
      },
      {
        "url": "https://example.com/gallery2",
        "jobId": "job2",
        "success": true
      },
      {
        "url": "https://example.com/gallery3",
        "jobId": "job3",
        "success": true
      }
    ]
  }
}
```

Each URL becomes a separate job.

### URL Limits

The number of URLs allowed in a single batch request is controlled by a per-user
setting, **Max Batch URLs**, found in **Settings > General Manager**. It
defaults to 200 and accepts any whole number from 1 to 10,000. There's also an
absolute hard cap of 10,000 URLs per request that no setting can raise.

This limit is enforced. Requests with more URLs than your configured maximum are
rejected with a 400 response before any jobs are started - see `Too many URLs`
below.

## Error Responses

Every error response follows the same shape:

```json
{
  "success": false,
  "error": "...",
  "timestamp": "..."
}
```

### Authentication Errors

**Missing or malformed Authorization header** (400):

```json
{
  "success": false,
  "error": "Authorization header with Bearer token is required"
}
```

**Empty Bearer token** (400):

```json
{
  "success": false,
  "error": "Bearer token cannot be empty"
}
```

**Invalid, expired, or revoked API key** (401):

```json
{
  "success": false,
  "error": "Invalid API key"
}
```

### Validation Errors

**Malformed JSON body** (400):

```json
{
  "success": false,
  "error": "Invalid request body. Expected valid JSON."
}
```

**Body is valid JSON but not an object** (400):

```json
{
  "success": false,
  "error": "Invalid request body. Expected a JSON object."
}
```

**Schema validation failed** (400) - returned for things like a malformed
`urlToProcess`/`urls` entry, or a `customDirectory`/`siteDirectory` that fails
its length or character checks. The response doesn't include the specific
reason:

```json
{
  "success": false,
  "error": "Invalid input provided."
}
```

**No URLs after normalization** (400) - both `urlToProcess` and `urls` were
empty or missing:

```json
{
  "success": false,
  "error": "At least one URL is required"
}
```

**Too many URLs** (400) - the batch exceeded your Max Batch URLs setting:

```json
{
  "success": false,
  "error": "Too many URLs. Max allowed is 200."
}
```

## Request Format

### Required Headers

- `Authorization: Bearer <your-api-key>` - Your API key (required)
- `Content-Type: application/json` - JSON data format (required)

### Request Body

Single URL:

```json
{
  "urlToProcess": "https://example.com/gallery"
}
```

Multiple URLs:

```json
{
  "urls": ["https://example.com/gallery1", "https://example.com/gallery2"]
}
```

## Examples

### Python

```python
import requests

api_key = "YOUR_API_KEY"
server = "http://localhost:7755"

url = "https://example.com/gallery"

response = requests.post(
    f"{server}/api/extension/external",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    },
    json={"urlToProcess": url}
)

if response.json()["success"]:
    print("Job created successfully!")
    print(f"Job ID: {response.json()['data']['results'][0]['jobId']}")
else:
    print(f"Error: {response.json()['error']}")
```

### nodejs

```javascript
const fetch = require('node-fetch');

const apiKey = 'YOUR_API_KEY';
const server = 'http://localhost:7755';
const url = 'https://example.com/gallery';

fetch(`${server}/api/extension/external`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ urlToProcess: url }),
})
  .then((r) => r.json())
  .then((data) => {
    if (data.success) {
      console.log('Job created:', data.data.results[0].jobId);
    } else {
      console.error('Error:', data.error);
    }
  });
```
