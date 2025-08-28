# Treeherder group_results API Performance Test Results (curl)

**Test Date:** 2025-08-27 19:32:31  
**Test Environment:** Local Docker  
**Base URL:** <http://localhost:8000/api>  
**Project:** autoland  
**Test Revision:** 8c8cc3df365d6c2732ba6af61a92dd6b433a1f57  
**Number of Runs per Endpoint:** 5  
**Database State:** Before index migration  
**Test Method:** curl (direct HTTP requests)

## Summary

This test measures the performance of all group_results API endpoints in Treeherder.
Each endpoint was called 5 times with the same revision to measure response times.
Tests performed using curl to avoid any Python/requests library overhead.

## Results

| Endpoint | Description | Avg Time (s) | Min Time (s) | Max Time (s) | Response Size (KB) |
|----------|-------------|--------------|--------------|--------------|-------------------|
| group_results | Primary optimized endpoint with Redis caching | .085 | 0.066505 | 0.094350 | 3862.3 |
| group_results_legacy | Legacy implementation - no optimizations | .171 | 0.144079 | 0.208624 | 3862.3 |
| group_results2 | Using get_group_results_new with push.id | .135 | 0.125533 | 0.139928 | 3862.3 |
| group_results3 | Using get_group_results_new_fast_dict | .137 | 0.122713 | 0.148661 | 3862.3 |
| group_results4 | Using get_group_results_new_orm | .126 | 0.113746 | 0.142353 | 3862.3 |
| group_results5 | Direct SQL without ORM overhead | .166 | 0.156681 | 0.178967 | 3862.3 |
| group_results6 | Job-first approach | .195 | 0.127659 | 0.258759 | 3862.3 |
| group_results7 | Job-first with JSON aggregation | .131 | 0.120647 | 0.144606 | 3862.3 |
| group_results8 | Optimized V1: values_list with dict | .130 | 0.117742 | 0.141704 | 3862.3 |
| group_results9 | Optimized V2: only() and iterator() | .153 | 0.139826 | 0.181588 | 3862.3 |
| group_results10 | Optimized V3: Raw SQL from Group table | .145 | 0.137040 | 0.159268 | 3862.3 |
| group_results11 | Optimized with caching | .092 | 0.072251 | 0.124101 | 3862.3 |

## Performance Ranking (by average time)

| Rank | Endpoint | Avg Time (s) |
|------|----------|--------------|
| 1 | group_results | .085 |
| 2 | group_results11 | .092 |
| 3 | group_results4 | .126 |
| 4 | group_results8 | .130 |
| 5 | group_results7 | .131 |
| 6 | group_results2 | .135 |
| 7 | group_results3 | .137 |
| 8 | group_results10 | .145 |
| 9 | group_results9 | .153 |
| 10 | group_results5 | .166 |
| 11 | group_results_legacy | .171 |
| 12 | group_results6 | .195 |

## Raw Timing Data

Detailed timing for each run (in seconds):

### group_results

Runs: 0.094350 0.081113 0.093574 0.091528 0.066505

### group_results_legacy

Runs: 0.144079 0.170393 0.171380 0.208624 0.165154

### group_results2

Runs: 0.125533 0.135288 0.137536 0.139928 0.139067

### group_results3

Runs: 0.122713 0.143443 0.125414 0.146859 0.148661

### group_results4

Runs: 0.117720 0.113746 0.123152 0.136990 0.142353

### group_results5

Runs: 0.160359 0.160111 0.178967 0.156681 0.174842

### group_results6

Runs: 0.127659 0.171064 0.258759 0.217919 0.200675

### group_results7

Runs: 0.122305 0.129609 0.142150 0.144606 0.120647

### group_results8

Runs: 0.117742 0.141704 0.125091 0.136178 0.133534

### group_results9

Runs: 0.153050 0.142143 0.152916 0.181588 0.139826

### group_results10

Runs: 0.141503 0.159268 0.146400 0.145294 0.137040

### group_results11

Runs: 0.124101 0.094998 0.076043 0.072251 0.094593
