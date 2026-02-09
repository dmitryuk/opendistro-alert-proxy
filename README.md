# OpenSearch Alert Proxy

A Node.js HTTP proxy service that generates direct links to OpenSearch Dashboards based on monitor configurations and time periods.

## Overview

This proxy service accepts HTTP requests with monitor information and time ranges, then generates direct links to:
- OpenSearch Discover view with the monitor's query filters applied
- Monitor edit pages in OpenSearch Alerting

The service automatically retrieves monitor configurations from OpenSearch, processes the queries, and generates properly formatted dashboard URLs with RISON-encoded parameters.

## Features

- **Monitor Query Links**: Generate direct links to OpenSearch Discover with monitor queries pre-applied
- **Time Range Support**: Automatically applies specified time periods to dashboard queries
- **Monitor Edit Links**: Quick access to monitor configuration pages
- **Filter Processing**: Removes timestamp range filters from monitor queries to allow custom time ranges
- **Docker Support**: Fully containerized setup with Docker Compose
- **Health Checks**: Includes health check configuration for OpenSearch services

## Prerequisites

- Node.js v25.0 or higher
- npm v11.8 or higher
- Docker and Docker Compose (for containerized setup)

## Installation

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd opendistro-alert-proxy
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (see Configuration section)

4. Start the development server:
```bash
npm run dev
```

### Docker Compose Setup

1. Configure your environment variables in `.env` file

2. Start all services:
```bash
docker-compose up
```

This will start:
- OpenSearch (port 9200)
- OpenSearch Dashboards (port 5601)
- Node.js proxy application (port 3000)

## Configuration

Create a `.env` file with the following variables:

```env
# OpenSearch credentials
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=yourStrongPassword123
OPENSEARCH_INITIAL_ADMIN_PASSWORD=yourStrongPassword123

# OpenSearch hosts
OPENSEARCH_DASHBOARDS_PRIVATE_HOST=http://opensearch-dashboards:5601
OPENSEARCH_DASHBOARDS_PUBLIC_HOST=http://opensearch-dashboards:5601
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENSEARCH_USERNAME` | OpenSearch authentication username | Yes |
| `OPENSEARCH_PASSWORD` | OpenSearch authentication password | Yes |
| `OPENSEARCH_INITIAL_ADMIN_PASSWORD` | Initial admin password for OpenSearch setup | Yes |
| `OPENSEARCH_DASHBOARDS_PRIVATE_HOST` | Internal URL for accessing OpenSearch Dashboards API | Yes |
| `OPENSEARCH_DASHBOARDS_PUBLIC_HOST` | Public URL for generating dashboard links | Yes |

## API Usage

### Generate Dashboard Query Link

Generates a link to OpenSearch Discover with the monitor's query applied for a specific time range.

**Endpoint:** `GET /`

**Query Parameters:**
- `monitorName` (required): Name of the monitor to retrieve query from
- `periodStart` (required): Start time for the query (e.g., `now-1h`, ISO timestamp)
- `periodEnd` (required): End time for the query (e.g., `now`, ISO timestamp)

**Example:**
```bash
curl "http://localhost:3000/?monitorName=my-monitor&periodStart=now-1h&periodEnd=now"
```

**Response:** HTTP 302 redirect to OpenSearch Dashboards Discover page

### Generate Monitor Edit Link

Generates a link to the monitor configuration page.

**Endpoint:** `GET /?edit`

**Query Parameters:**
- `monitorName` (required): Name of the monitor to edit
- `edit` (required): Flag to indicate edit mode (no value needed)
- `periodStart` (required): Any value (required but ignored)
- `periodEnd` (required): Any value (required but ignored)

**Example:**
```bash
curl "http://localhost:3000/?monitorName=my-monitor&edit&periodStart=now&periodEnd=now"
```

**Response:** HTTP 302 redirect to OpenSearch Alerting monitor edit page

## Architecture

### Components

- **`src/app.ts`** - Main HTTP server that handles incoming requests and routing
- **`src/open-distro/client.ts`** - OpenSearch API client for fetching monitor and index pattern data
- **`src/open-distro/processor.ts`** - Processes monitor queries and generates dashboard URLs with RISON encoding

### Flow

1. Client sends HTTP request with monitor name and time parameters
2. Server validates required parameters
3. `OpendistroClient` fetches monitor configuration from OpenSearch API
4. `OpendistroProcessor` processes the query:
   - Removes timestamp range filters
   - Retrieves index pattern ID
   - Encodes query parameters using RISON format
5. Server responds with 302 redirect to generated dashboard URL

## Development

### Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start development server with hot-reload and debugging
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Run ESLint and automatically fix issues

### Debugging

The development server runs with Node.js inspector on port 9229. You can attach a debugger using:
- Chrome DevTools: `chrome://inspect`
- VS Code/IntelliJ: Configure remote debugging to `localhost:9229`

## Docker Services

### OpenSearch
- **Image:** `opensearchproject/opensearch:2.12.0`
- **Ports:** 9200 (API), 9600 (Performance Analyzer)
- **Memory:** 512MB (Xms/Xmx)

### OpenSearch Dashboards
- **Image:** `opensearchproject/opensearch-dashboards:2.12.0`
- **Port:** 5601

### Node.js Application
- **Port:** 3000 (mapped from internal port 80)
- **Debug Port:** 9229
- **Volume:** Source code mounted for hot-reload

## Error Handling

The service returns appropriate HTTP status codes:

- `400 Bad Request` - Missing required query parameters
- `302 Found` - Successful redirect to dashboard
- `500 Internal Server Error` - Monitor not found, API errors, or processing failures

## Security Notes

- TLS certificate verification is disabled (`NODE_TLS_REJECT_UNAUTHORIZED = "0"`) for development
- Basic authentication is used for OpenSearch API calls
- For production use, enable proper SSL/TLS verification and use secure credentials

## Docker Hub Publishing

The project includes a GitHub Action workflow that automatically builds and publishes Docker images to Docker Hub when you create a new tag.

### Setup

1. Create Docker Hub credentials:
   - Generate a Docker Hub Access Token at https://hub.docker.com/settings/security

2. Add GitHub Secrets to your repository (Settings → Secrets and variables → Actions):
   - `DOCKERHUB_USERNAME` - Your Docker Hub username
   - `DOCKERHUB_TOKEN` - Your Docker Hub access token

3. Move the workflow file to the correct location:
   ```bash
   mkdir -p .github/workflows
   mv docker-publish.yml .github/workflows/
   ```

### Publishing a New Version

To publish a new Docker image, create and push a version tag:

```bash
# Create a new tag (semver format: v1.0.0, v2.1.3, etc.)
git tag v1.0.0

# Push the tag to GitHub
git push origin v1.0.0
```

This will automatically:
- Build a multi-platform Docker image (linux/amd64, linux/arm64)
- Tag the image with the version number (e.g., `1.0.0`)
- Tag the image with major.minor (e.g., `1.0`)
- Tag the image with major version (e.g., `1`)
- Tag as `latest` if on the default branch
- Push all tags to Docker Hub

### Using the Published Image

```bash
# Pull the latest version
docker pull <your-dockerhub-username>/opendistro-alert-proxy:latest

# Pull a specific version
docker pull <your-dockerhub-username>/opendistro-alert-proxy:1.0.0
```

## License

ISC

## Author

See `package.json` for author information
