#!/bin/bash

# Performance test script for Treeherder group_results API endpoints using curl
# Tests each endpoint multiple times and records timing information

BASE_URL="http://localhost:8000/api"
PROJECT="autoland"
REVISION="8c8cc3df365d6c2732ba6af61a92dd6b433a1f57"
NUM_RUNS=5
OUTPUT_FILE="group_results_performance_optimized_indexes.md"

# Endpoints to test
declare -a endpoints=(
    "group_results|Primary optimized endpoint with Redis caching"
    "group_results_legacy|Legacy implementation - no optimizations"
    "group_results2|Using get_group_results_new with push.id"
    "group_results3|Using get_group_results_new_fast_dict"
    "group_results4|Using get_group_results_new_orm"
    "group_results5|Direct SQL without ORM overhead"
    "group_results6|Job-first approach"
    "group_results7|Job-first with JSON aggregation"
    "group_results8|Optimized V1: values_list with dict"
    "group_results9|Optimized V2: only() and iterator()"
    "group_results10|Optimized V3: Raw SQL from Group table"
    "group_results11|Optimized with caching"
)

# Arrays to store results
declare -a names=()
declare -a descriptions=()
declare -a avg_times=()
declare -a min_times=()
declare -a max_times=()
declare -a response_sizes=()
declare -a all_times=()

echo "================================================================================"
echo "Treeherder group_results API Performance Test (using curl)"
echo "================================================================================"
echo ""
echo "Testing revision: $REVISION"
echo "Testing ${#endpoints[@]} endpoints with $NUM_RUNS runs each"
echo "================================================================================"

# Test each endpoint
endpoint_count=0
for endpoint_info in "${endpoints[@]}"; do
    endpoint_count=$((endpoint_count + 1))
    IFS='|' read -r endpoint description <<< "$endpoint_info"
    
    echo ""
    echo "[$endpoint_count/${#endpoints[@]}] Testing $endpoint..."
    echo "  Description: $description"
    
    url="$BASE_URL/project/$PROJECT/push/$endpoint/?revision=$REVISION"
    
    times=()
    total_time=0
    min_time=999999
    max_time=0
    response_size=0
    
    # Run the test multiple times
    for run in $(seq 1 $NUM_RUNS); do
        # Use curl with timing information
        result=$(curl -w "\n%{time_total}|%{size_download}|%{http_code}" -s -o /tmp/curl_response.txt "$url" 2>/dev/null)
        
        # Parse the result - get the last line which has our timing data
        timing_line=$(echo "$result" | tail -n 1)
        time_taken=$(echo "$timing_line" | cut -d'|' -f1)
        size=$(echo "$timing_line" | cut -d'|' -f2)
        http_code=$(echo "$timing_line" | cut -d'|' -f3)
        
        if [ "$http_code" == "200" ]; then
            echo "  Run $run: ${time_taken}s (${size} bytes)"
            times+=($time_taken)
            
            # Track response size from first successful run
            if [ "$response_size" == "0" ]; then
                response_size=$size
            fi
            
            # Calculate min/max
            if (( $(echo "$time_taken < $min_time" | bc -l) )); then
                min_time=$time_taken
            fi
            if (( $(echo "$time_taken > $max_time" | bc -l) )); then
                max_time=$time_taken
            fi
            
            total_time=$(echo "$total_time + $time_taken" | bc -l)
        else
            echo "  Run $run: Failed with status $http_code"
        fi
        
        # Small delay between runs
        if [ "$run" -lt "$NUM_RUNS" ]; then
            sleep 0.5
        fi
    done
    
    # Calculate average if we had successful runs
    if [ ${#times[@]} -gt 0 ]; then
        avg_time=$(echo "scale=3; $total_time / ${#times[@]}" | bc -l)
        echo "  Average response time: ${avg_time}s"
        echo "  Min: ${min_time}s, Max: ${max_time}s"
        echo "  Response size: $(echo "scale=1; $response_size / 1024" | bc -l) KB"
    else
        avg_time="N/A"
        min_time="N/A"
        max_time="N/A"
        echo "  No successful runs"
    fi
    
    # Store results
    names+=("$endpoint")
    descriptions+=("$description")
    avg_times+=("$avg_time")
    min_times+=("$min_time")
    max_times+=("$max_time")
    response_sizes+=("$response_size")
    all_times+=("${times[*]}")
done

# Write results to markdown file
echo ""
echo "================================================================================"
echo "Writing results to $OUTPUT_FILE..."

cat > "$OUTPUT_FILE" << EOF
# Treeherder group_results API Performance Test Results (curl)

**Test Date:** $(date '+%Y-%m-%d %H:%M:%S')  
**Test Environment:** Local Docker  
**Base URL:** $BASE_URL  
**Project:** $PROJECT  
**Test Revision:** $REVISION  
**Number of Runs per Endpoint:** $NUM_RUNS  
**Database State:** After optimized index migration (targeting Django ORM query paths)  
**Test Method:** curl (direct HTTP requests)

## Summary

This test measures the performance of all group_results API endpoints in Treeherder.
Each endpoint was called $NUM_RUNS times with the same revision to measure response times.
Tests performed using curl to avoid any Python/requests library overhead.

## Results

| Endpoint | Description | Avg Time (s) | Min Time (s) | Max Time (s) | Response Size (KB) |
|----------|-------------|--------------|--------------|--------------|-------------------|
EOF

# Add results to table
for i in "${!names[@]}"; do
    name="${names[$i]}"
    desc="${descriptions[$i]}"
    avg="${avg_times[$i]}"
    min="${min_times[$i]}"
    max="${max_times[$i]}"
    size_kb=$(echo "scale=1; ${response_sizes[$i]} / 1024" | bc -l 2>/dev/null || echo "N/A")
    
    echo "| $name | $desc | $avg | $min | $max | $size_kb |" >> "$OUTPUT_FILE"
done

# Add performance ranking
echo "" >> "$OUTPUT_FILE"
echo "## Performance Ranking (by average time)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| Rank | Endpoint | Avg Time (s) |" >> "$OUTPUT_FILE"
echo "|------|----------|--------------|" >> "$OUTPUT_FILE"

# Create a temporary file with sortable data
temp_file=$(mktemp)
for i in "${!names[@]}"; do
    if [ "${avg_times[$i]}" != "N/A" ]; then
        echo "${avg_times[$i]}|${names[$i]}" >> "$temp_file"
    fi
done

# Sort and add to markdown
rank=1
sort -n "$temp_file" | while IFS='|' read -r time name; do
    echo "| $rank | $name | $time |" >> "$OUTPUT_FILE"
    rank=$((rank + 1))
done

rm "$temp_file"

# Add raw timing data
echo "" >> "$OUTPUT_FILE"
echo "## Raw Timing Data" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Detailed timing for each run (in seconds):" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

for i in "${!names[@]}"; do
    if [ "${all_times[$i]}" != "" ]; then
        echo "### ${names[$i]}" >> "$OUTPUT_FILE"
        echo "Runs: ${all_times[$i]}" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi
done

echo "Results written to $OUTPUT_FILE"
echo "================================================================================"
echo ""
echo "Test completed!"