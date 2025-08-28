# Treeherder group_results API Performance Test Results (curl)

**Test Date:** 2025-08-27 19:56:13  
**Test Environment:** Local Docker  
**Base URL:** <http://localhost:8000/api>  
**Project:** autoland  
**Test Revision:** 8c8cc3df365d6c2732ba6af61a92dd6b433a1f57  
**Number of Runs per Endpoint:** 5  
**Database State:** After enhanced log parsing (more groups/failure data)  
**Test Method:** curl (direct HTTP requests)

## Summary

This test measures the performance of all group_results API endpoints in Treeherder.
Each endpoint was called 5 times with the same revision to measure response times.
Tests performed using curl to avoid any Python/requests library overhead.

## Results

| Endpoint | Description | Avg Time (s) | Min Time (s) | Max Time (s) | Response Size (KB) |
|----------|-------------|--------------|--------------|--------------|-------------------|
| group_results | Primary optimized endpoint with Redis caching | .104 | 0.072134 | 0.166861 | 3983.1 |
| group_results_legacy | Legacy implementation - no optimizations | .169 | 0.160676 | 0.181974 | 3983.1 |
| group_results2 | Using get_group_results_new with push.id | .142 | 0.126563 | 0.149788 | 3983.1 |
| group_results3 | Using get_group_results_new_fast_dict | .144 | 0.131450 | 0.157107 | 3983.1 |
| group_results4 | Using get_group_results_new_orm | .138 | 0.124565 | 0.148967 | 3983.1 |
| group_results5 | Direct SQL without ORM overhead | .178 | 0.168879 | 0.185904 | 3983.1 |
| group_results6 | Job-first approach | .165 | 0.137564 | 0.226929 | 3983.1 |
| group_results7 | Job-first with JSON aggregation | .137 | 0.122820 | 0.149679 | 3983.1 |
| group_results8 | Optimized V1: values_list with dict | .133 | 0.119752 | 0.146535 | 3983.1 |
| group_results9 | Optimized V2: only() and iterator() | .168 | 0.152804 | 0.180031 | 3983.1 |
| group_results10 | Optimized V3: Raw SQL from Group table | .150 | 0.136404 | 0.168978 | 3983.1 |
| group_results11 | Optimized with caching | .083 | 0.066801 | 0.125465 | 3983.1 |

## Performance Ranking (by average time)

| Rank | Endpoint | Avg Time (s) |
|------|----------|--------------|
| 1 | group_results11 | .083 |
| 2 | group_results | .104 |
| 3 | group_results8 | .133 |
| 4 | group_results7 | .137 |
| 5 | group_results4 | .138 |
| 6 | group_results2 | .142 |
| 7 | group_results3 | .144 |
| 8 | group_results10 | .150 |
| 9 | group_results6 | .165 |
| 10 | group_results9 | .168 |
| 11 | group_results_legacy | .169 |
| 12 | group_results5 | .178 |

## Raw Timing Data

Detailed timing for each run (in seconds):

### group_results

Runs: 0.166861 0.072134 0.093353 0.091160 0.096510

### group_results_legacy

Runs: 0.162326 0.175292 0.160676 0.167828 0.181974

### group_results2

Runs: 0.126563 0.147853 0.143847 0.149788 0.143217

### group_results3

Runs: 0.131450 0.157107 0.156569 0.132085 0.147568

### group_results4

Runs: 0.124565 0.148967 0.145747 0.147931 0.126842

### group_results5

Runs: 0.168879 0.174863 0.183124 0.185904 0.180567

### group_results6

Runs: 0.137564 0.152689 0.152503 0.156983 0.226929

### group_results7

Runs: 0.122820 0.144709 0.138064 0.134077 0.149679

### group_results8

Runs: 0.119752 0.124937 0.131335 0.143325 0.146535

### group_results9

Runs: 0.152804 0.176972 0.156066 0.180031 0.175095

### group_results10

Runs: 0.136404 0.165100 0.145745 0.138315 0.168978

### group_results11

Runs: 0.125465 0.078846 0.079961 0.066801 0.068328
