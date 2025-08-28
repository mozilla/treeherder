# Treeherder group_results API Performance Test Results (curl)

**Test Date:** 2025-08-27 20:50:34  
**Test Environment:** Local Docker  
**Base URL:** <http://localhost:8000/api>  
**Project:** autoland  
**Test Revision:** 8c8cc3df365d6c2732ba6af61a92dd6b433a1f57  
**Number of Runs per Endpoint:** 5  
**Database State:** After optimized index migration (targeting Django ORM query paths)  
**Test Method:** curl (direct HTTP requests)

## Summary

This test measures the performance of all group_results API endpoints in Treeherder.
Each endpoint was called 5 times with the same revision to measure response times.
Tests performed using curl to avoid any Python/requests library overhead.

## Results

| Endpoint | Description | Avg Time (s) | Min Time (s) | Max Time (s) | Response Size (KB) |
|----------|-------------|--------------|--------------|--------------|-------------------|
| group_results | Primary optimized endpoint with Redis caching | .095 | 0.079181 | 0.105253 | 3983.1 |
| group_results_legacy | Legacy implementation - no optimizations | .176 | 0.157543 | 0.189224 | 3983.1 |
| group_results2 | Using get_group_results_new with push.id | .138 | 0.134598 | 0.143196 | 3983.1 |
| group_results3 | Using get_group_results_new_fast_dict | .148 | 0.117853 | 0.159458 | 3983.1 |
| group_results4 | Using get_group_results_new_orm | .129 | 0.119893 | 0.134261 | 3983.1 |
| group_results5 | Direct SQL without ORM overhead | .163 | 0.146590 | 0.173105 | 3983.1 |
| group_results6 | Job-first approach | .137 | 0.120379 | 0.148104 | 3983.1 |
| group_results7 | Job-first with JSON aggregation | .133 | 0.112540 | 0.142263 | 3983.1 |
| group_results8 | Optimized V1: values_list with dict | .129 | 0.108913 | 0.137477 | 3983.1 |
| group_results9 | Optimized V2: only() and iterator() | .163 | 0.147432 | 0.169036 | 3983.1 |
| group_results10 | Optimized V3: Raw SQL from Group table | .143 | 0.126431 | 0.155821 | 3983.1 |
| group_results11 | Optimized with caching | .090 | 0.079929 | 0.119380 | 3983.1 |

## Performance Ranking (by average time)

| Rank | Endpoint | Avg Time (s) |
|------|----------|--------------|
| 1 | group_results11 | .090 |
| 2 | group_results | .095 |
| 3 | group_results4 | .129 |
| 4 | group_results8 | .129 |
| 5 | group_results7 | .133 |
| 6 | group_results6 | .137 |
| 7 | group_results2 | .138 |
| 8 | group_results10 | .143 |
| 9 | group_results3 | .148 |
| 10 | group_results5 | .163 |
| 11 | group_results9 | .163 |
| 12 | group_results_legacy | .176 |

## Raw Timing Data

Detailed timing for each run (in seconds):

### group_results

Runs: 0.105253 0.088774 0.103210 0.079181 0.099732

### group_results_legacy

Runs: 0.157543 0.184181 0.183643 0.189224 0.167286

### group_results2

Runs: 0.141441 0.143196 0.139170 0.136373 0.134598

### group_results3

Runs: 0.117853 0.151711 0.159458 0.155042 0.156359

### group_results4

Runs: 0.119893 0.134261 0.132404 0.128670 0.130919

### group_results5

Runs: 0.146590 0.173105 0.160617 0.169720 0.166168

### group_results6

Runs: 0.120379 0.137316 0.148104 0.146270 0.134178

### group_results7

Runs: 0.112540 0.140301 0.139165 0.131015 0.142263

### group_results8

Runs: 0.108913 0.131108 0.137477 0.135534 0.132010

### group_results9

Runs: 0.147432 0.167017 0.166338 0.168080 0.169036

### group_results10

Runs: 0.126431 0.134163 0.146073 0.155821 0.154456

### group_results11

Runs: 0.119380 0.087118 0.079929 0.088420 0.080151
