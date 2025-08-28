# Treeherder group_results API Performance Test Results (curl)

**Test Date:** 2025-08-27 20:05:47  
**Test Environment:** Local Docker  
**Base URL:** <http://localhost:8000/api>  
**Project:** autoland  
**Test Revision:** 8c8cc3df365d6c2732ba6af61a92dd6b433a1f57  
**Number of Runs per Endpoint:** 5  
**Database State:** Final baseline before index migration  
**Test Method:** curl (direct HTTP requests)

## Summary

This test measures the performance of all group_results API endpoints in Treeherder.
Each endpoint was called 5 times with the same revision to measure response times.
Tests performed using curl to avoid any Python/requests library overhead.

## Results

| Endpoint | Description | Avg Time (s) | Min Time (s) | Max Time (s) | Response Size (KB) |
|----------|-------------|--------------|--------------|--------------|-------------------|
| group_results | Primary optimized endpoint with Redis caching | .104 | 0.085123 | 0.158668 | 3983.1 |
| group_results_legacy | Legacy implementation - no optimizations | .190 | 0.155663 | 0.271065 | 3983.1 |
| group_results2 | Using get_group_results_new with push.id | .141 | 0.125396 | 0.153585 | 3983.1 |
| group_results3 | Using get_group_results_new_fast_dict | .149 | 0.134813 | 0.163750 | 3983.1 |
| group_results4 | Using get_group_results_new_orm | .134 | 0.123597 | 0.145572 | 3983.1 |
| group_results5 | Direct SQL without ORM overhead | .166 | 0.153792 | 0.184351 | 3983.1 |
| group_results6 | Job-first approach | .145 | 0.128476 | 0.152872 | 3983.1 |
| group_results7 | Job-first with JSON aggregation | .139 | 0.120350 | 0.150466 | 3983.1 |
| group_results8 | Optimized V1: values_list with dict | .139 | 0.122427 | 0.152546 | 3983.1 |
| group_results9 | Optimized V2: only() and iterator() | .171 | 0.150412 | 0.180746 | 3983.1 |
| group_results10 | Optimized V3: Raw SQL from Group table | .163 | 0.137833 | 0.185642 | 3983.1 |
| group_results11 | Optimized with caching | .094 | 0.077388 | 0.134145 | 3983.1 |

## Performance Ranking (by average time)

| Rank | Endpoint | Avg Time (s) |
|------|----------|--------------|
| 1 | group_results11 | .094 |
| 2 | group_results | .104 |
| 3 | group_results4 | .134 |
| 4 | group_results7 | .139 |
| 5 | group_results8 | .139 |
| 6 | group_results2 | .141 |
| 7 | group_results6 | .145 |
| 8 | group_results3 | .149 |
| 9 | group_results10 | .163 |
| 10 | group_results5 | .166 |
| 11 | group_results9 | .171 |
| 12 | group_results_legacy | .190 |

## Raw Timing Data

Detailed timing for each run (in seconds):

### group_results

Runs: 0.158668 0.085123 0.092802 0.095424 0.088197

### group_results_legacy

Runs: 0.155663 0.176664 0.175912 0.174441 0.271065

### group_results2

Runs: 0.125396 0.153585 0.144589 0.133826 0.151699

### group_results3

Runs: 0.134813 0.150392 0.146681 0.163750 0.151902

### group_results4

Runs: 0.123597 0.145521 0.126842 0.132244 0.145572

### group_results5

Runs: 0.153792 0.156755 0.181206 0.184351 0.157804

### group_results6

Runs: 0.128476 0.152370 0.152872 0.141391 0.152784

### group_results7

Runs: 0.120350 0.145361 0.141885 0.150466 0.141516

### group_results8

Runs: 0.122427 0.152546 0.138249 0.142732 0.141267

### group_results9

Runs: 0.150412 0.178327 0.173337 0.180746 0.175522

### group_results10

Runs: 0.137833 0.185642 0.162411 0.160871 0.171762

### group_results11

Runs: 0.134145 0.089582 0.090974 0.080394 0.077388
