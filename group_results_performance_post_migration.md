# Treeherder group_results API Performance Test Results (curl)

**Test Date:** 2025-08-27 20:17:05  
**Test Environment:** Local Docker  
**Base URL:** <http://localhost:8000/api>  
**Project:** autoland  
**Test Revision:** 8c8cc3df365d6c2732ba6af61a92dd6b433a1f57  
**Number of Runs per Endpoint:** 5  
**Database State:** After performance index migration  
**Test Method:** curl (direct HTTP requests)

## Summary

This test measures the performance of all group_results API endpoints in Treeherder.
Each endpoint was called 5 times with the same revision to measure response times.
Tests performed using curl to avoid any Python/requests library overhead.

## Results

| Endpoint | Description | Avg Time (s) | Min Time (s) | Max Time (s) | Response Size (KB) |
|----------|-------------|--------------|--------------|--------------|-------------------|
| group_results | Primary optimized endpoint with Redis caching | .114 | 0.093913 | 0.184048 | 3983.1 |
| group_results_legacy | Legacy implementation - no optimizations | .172 | 0.155221 | 0.180828 | 3983.1 |
| group_results2 | Using get_group_results_new with push.id | .135 | 0.121005 | 0.146232 | 3983.1 |
| group_results3 | Using get_group_results_new_fast_dict | .144 | 0.128239 | 0.156730 | 3983.1 |
| group_results4 | Using get_group_results_new_orm | .142 | 0.118484 | 0.150863 | 3983.1 |
| group_results5 | Direct SQL without ORM overhead | .178 | 0.155845 | 0.186005 | 3983.1 |
| group_results6 | Job-first approach | .144 | 0.125994 | 0.155563 | 3983.1 |
| group_results7 | Job-first with JSON aggregation | .159 | 0.121374 | 0.242776 | 3983.1 |
| group_results8 | Optimized V1: values_list with dict | .141 | 0.121582 | 0.150755 | 3983.1 |
| group_results9 | Optimized V2: only() and iterator() | .168 | 0.146406 | 0.179275 | 3983.1 |
| group_results10 | Optimized V3: Raw SQL from Group table | .151 | 0.138375 | 0.163312 | 3983.1 |
| group_results11 | Optimized with caching | .099 | 0.086622 | 0.125189 | 3983.1 |

## Performance Ranking (by average time)

| Rank | Endpoint | Avg Time (s) |
|------|----------|--------------|
| 1 | group_results11 | .099 |
| 2 | group_results | .114 |
| 3 | group_results2 | .135 |
| 4 | group_results8 | .141 |
| 5 | group_results4 | .142 |
| 6 | group_results3 | .144 |
| 7 | group_results6 | .144 |
| 8 | group_results10 | .151 |
| 9 | group_results7 | .159 |
| 10 | group_results9 | .168 |
| 11 | group_results_legacy | .172 |
| 12 | group_results5 | .178 |

## Raw Timing Data

Detailed timing for each run (in seconds):

### group_results

Runs: 0.184048 0.098710 0.097722 0.100370 0.093913

### group_results_legacy

Runs: 0.165795 0.179262 0.180828 0.179183 0.155221

### group_results2

Runs: 0.121005 0.131895 0.146232 0.146147 0.133202

### group_results3

Runs: 0.128239 0.155634 0.145310 0.138197 0.156730

### group_results4

Runs: 0.118484 0.148844 0.146736 0.148930 0.150863

### group_results5

Runs: 0.155845 0.182238 0.186005 0.183081 0.182918

### group_results6

Runs: 0.125994 0.132894 0.153844 0.154113 0.155563

### group_results7

Runs: 0.121374 0.136874 0.149101 0.242776 0.145281

### group_results8

Runs: 0.121582 0.144766 0.150755 0.149427 0.143455

### group_results9

Runs: 0.146406 0.161382 0.177885 0.177082 0.179275

### group_results10

Runs: 0.138375 0.149811 0.163312 0.161921 0.144978

### group_results11

Runs: 0.125189 0.092011 0.095566 0.086622 0.098324
