# Treeherder Local vs Staging Comparison Tools

This directory contains a comprehensive suite of tools to compare your local Treeherder development environment with the staging server at `https://treeherder.allizom.org`.

## Overview

The comparison suite includes:

1. **API Comparator** - Compares REST API endpoints and responses
2. **UI Comparator** - Visual regression testing using Puppeteer
3. **Database Comparator** - Schema and data comparison
4. **Configuration Comparator** - Environment and settings comparison
5. **Master Comparator** - Orchestrates all tools and generates comprehensive reports

## Quick Start

### Prerequisites

1. **Local Treeherder Environment Running**:

   ```bash
   cd /path/to/treeherder
   docker-compose up -d
   ```

2. **Python Dependencies**:

   ```bash
   pip install requests psycopg2-binary
   ```

3. **Node.js Dependencies** (for UI comparison):

   ```bash
   npm install puppeteer
   ```

### Run Complete Comparison

```bash
# Run all comparison tools
python run_comparison.py

# Run with custom URLs
python run_comparison.py --local http://localhost:8000 --staging https://treeherder.allizom.org

# Skip specific tools
python run_comparison.py --skip ui db

# Custom output directory
python run_comparison.py --output ./my-comparison-results
```

### Run Individual Tools

```bash
# API comparison only
python api_comparator.py --output api_report.json

# UI comparison only
node ui_comparator.js --output ./ui-results

# Database comparison only
python db_comparator.py --local-db "postgresql://postgres:mozilla1234@localhost:5499/treeherder"

# Configuration comparison only
python config_comparator.py --output config_report.json
```

## Tool Details

### 1. API Comparator (`api_comparator.py`)

Compares REST API endpoints between local and staging environments.

**Features:**

- Response data comparison
- Status code validation
- Response time measurement
- JSON diff generation
- Comprehensive error handling

**Key Endpoints Tested:**

- `/api/` - API root
- `/api/repository/` - Repository configurations
- `/api/project/` - Project data
- `/api/jobs/` - Job data (limited)
- `/api/push/` - Push information (limited)
- `/api/performance/framework/` - Perfherder frameworks
- `/api/bugzilla/` - Bugzilla integration

**Usage:**

```bash
python api_comparator.py [options]

Options:
  --local URL       Local base URL (default: http://localhost:8000)
  --staging URL     Staging base URL (default: https://treeherder.allizom.org)
  --endpoints LIST  Specific endpoints to compare
  --output FILE     JSON report output file
  --verbose         Show detailed differences
```

**Output:**

- JSON report with detailed comparison results
- Console summary with pass/fail status
- Performance metrics and response times

### 2. UI Comparator (`ui_comparator.js`)

Visual regression testing using Puppeteer to compare UI between environments.

**Features:**

- Full-page screenshots
- Image comparison (basic)
- Load time measurement
- Console error detection
- Responsive design testing

**Pages Tested:**

- Homepage (`/`)
- Jobs view (`/#/jobs?repo=autoland`)
- Try jobs (`/#/jobs?repo=try`)
- Perfherder (`/perf.html`)
- Perfherder alerts (`/perf.html#/alerts`)
- Intermittent failures (`/intermittent-failures.html`)
- Push health (`/pushhealth.html`)

**Usage:**

```bash
node ui_comparator.js [options]

Options:
  --local URL       Local base URL (default: http://localhost:5001)
  --staging URL     Staging base URL (default: https://treeherder.allizom.org)
  --output DIR      Output directory for screenshots and reports
  --timeout MS      Page load timeout (default: 30000)
```

**Output:**

- Screenshots for each page (local and staging)
- HTML report with side-by-side comparisons
- JSON report with metrics and differences
- Load time analysis

### 3. Database Comparator (`db_comparator.py`)

Compares database schemas and data between local and staging environments.

**Features:**

- Schema comparison (tables, columns, indexes, constraints)
- Row count analysis
- Data type validation
- Missing table detection
- Sample data comparison

**Key Tables Analyzed:**

- `repository`, `repository_group`
- `option_collection`, `failure_classification`
- `job_type`, `machine`, `product`
- `build_platform`, `machine_platform`
- `performance_framework`, `performance_signature`
- `push`, `job`, `text_log_summary`
- `bug_job_map`, `classified_failure`

**Usage:**

```bash
python db_comparator.py [options]

Options:
  --local-db URL    Local database URL (required)
  --staging-db URL  Staging database URL (optional)
  --output FILE     JSON report output file
  --tables LIST     Specific tables to compare
```

**Output:**

- JSON report with schema differences
- Row count comparisons
- Missing table analysis
- Column definition differences

### 4. Configuration Comparator (`config_comparator.py`)

Compares configuration settings and environment variables.

**Features:**

- Environment variable comparison
- Django settings analysis
- Docker Compose configuration
- Git repository status
- Service endpoint validation

**Configuration Sources:**

- Environment variables
- Django settings (via management command)
- Docker Compose configuration
- Git repository information
- API endpoint responses (`/__version__`, `/__heartbeat__`)

**Usage:**

```bash
python config_comparator.py [options]

Options:
  --local URL       Local base URL (default: http://localhost:8000)
  --staging URL     Staging base URL (default: https://treeherder.allizom.org)
  --output FILE     JSON report output file
```

**Output:**

- Configuration differences report
- Environment variable status
- Django settings comparison
- Service health check results

### 5. Master Comparator (`run_comparison.py`)

Orchestrates all comparison tools and generates comprehensive reports.

**Features:**

- Runs all comparison tools in sequence
- Prerequisite checking
- Comprehensive HTML and JSON reports
- Failure analysis and recommendations
- Success rate calculation

**Usage:**

```bash
python run_comparison.py [options]

Options:
  --local URL       Local base URL (default: http://localhost:8000)
  --staging URL     Staging base URL (default: https://treeherder.allizom.org)
  --output DIR      Output directory (default: ./comparison-results)
  --skip TOOLS      Skip specific tools (api, ui, db, config)
```

**Output:**

- Master HTML report with all results
- Individual tool reports
- Recommendations and action items
- Success/failure summary

## Environment Setup

### Local Environment URLs

When running locally via Docker Compose:

- **Backend API**: `http://localhost:8000`
- **Frontend**: `http://localhost:5001` (note: port may vary)
- **Database**: `postgresql://postgres:mozilla1234@localhost:5499/treeherder`
- **Redis**: `redis://localhost:6388`

### Staging Environment

- **Base URL**: `https://treeherder.allizom.org`
- **API**: `https://treeherder.allizom.org/api/`

## Troubleshooting

### Common Issues

1. **Local services not running**:

   ```bash
   docker-compose ps  # Check service status
   docker-compose up -d  # Start services
   ```

2. **Database connection issues**:

   ```bash
   # Check database port mapping
   docker-compose ps postgres
   
   # Test connection
   psql -h localhost -p 5499 -U postgres -d treeherder
   ```

3. **Frontend not accessible**:

   ```bash
   # Check frontend port
   docker-compose ps frontend
   
   # Frontend might be on port 5000 or 5001
   curl http://localhost:5001
   ```

4. **Missing Python dependencies**:

   ```bash
   pip install requests psycopg2-binary
   ```

5. **Missing Node.js dependencies**:

   ```bash
   npm install puppeteer
   ```

### Port Conflicts

If you encounter port conflicts, check your `docker-compose.yml` for port mappings:

- Backend: `8000:8000`
- Frontend: `5001:5000` (or `5000:5000`)
- PostgreSQL: `5499:5432` (or `5432:5432`)
- Redis: `6388:6379` (or `6379:6379`)

## Interpreting Results

### Success Criteria

- **API Comparison**: All endpoints return same status codes and similar data structures
- **UI Comparison**: Screenshots match (within tolerance) and no console errors
- **Database Comparison**: Schema matches and row counts are reasonable
- **Configuration Comparison**: Key settings match between environments

### Common Differences (Expected)

Some differences are expected and normal:

- **Timestamps**: Creation dates, last modified times
- **IDs**: Auto-generated primary keys
- **Data Volume**: Staging may have more data than local
- **Performance**: Response times may vary
- **Environment Variables**: Some settings are environment-specific

### Red Flags (Investigate)

- **Missing API endpoints**: Indicates version mismatch
- **Schema differences**: May indicate migration issues
- **Console errors**: JavaScript errors in UI
- **Significant performance differences**: May indicate configuration issues

## Automation

### Continuous Integration

Add to your CI pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run Treeherder Comparison
  run: |
    docker-compose up -d
    sleep 30  # Wait for services to start
    python comparison-tools/run_comparison.py --skip ui
    
- name: Upload Comparison Results
  uses: actions/upload-artifact@v2
  with:
    name: comparison-results
    path: comparison-results/
```

### Scheduled Monitoring

Set up cron job for regular comparisons:

```bash
# Daily comparison at 2 AM
0 2 * * * cd /path/to/treeherder && python comparison-tools/run_comparison.py --output /var/log/treeherder-comparison/$(date +\%Y\%m\%d)
```

## Contributing

To add new comparison tools or improve existing ones:

1. Follow the existing pattern for tool structure
2. Add comprehensive error handling
3. Generate both JSON and human-readable reports
4. Update this README with new tool documentation
5. Add the tool to the master comparator

## Support

For issues with the comparison tools:

1. Check the troubleshooting section above
2. Review individual tool error messages
3. Ensure all prerequisites are met
4. Check Treeherder documentation for environment setup

## Files

- `api_comparator.py` - API endpoint comparison tool
- `ui_comparator.js` - UI visual regression testing tool
- `db_comparator.py` - Database schema and data comparison tool
- `config_comparator.py` - Configuration drift detection tool
- `run_comparison.py` - Master orchestration script
- `README.md` - This documentation file
- `package.json` - Node.js dependencies (created when needed)
