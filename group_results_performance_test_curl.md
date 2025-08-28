# Treeherder group_results API Performance Test Results (curl)

**Test Date:** 2025-08-27 19:05:44  
**Test Environment:** Local Docker  
**Base URL:** <http://localhost:8000/api>  
**Project:** autoland  
**Test Revision:** 95166f5b2a85db5652bc134b51d3d43a3455a26c  
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
| group_results | Primary optimized endpoint with Redis caching | .032 | 0.026042 | 0.036656 | 0 |
| group_results_legacy | Legacy implementation - no optimizations | .039 | 0.027847 | 0.047701 | 0 |
| group_results2 | Using get_group_results_new with push.id | .044 | 0.030340 | 0.050786 | 0 |
| group_results3 | Using get_group_results_new_fast_dict | .041 | 0.029223 | 0.049291 | 0 |
| group_results4 | Using get_group_results_new_orm | .054 | 0.043636 | 0.060978 | 0 |
| group_results5 | Direct SQL without ORM overhead | .037 | 0.026246 | 0.043812 | 0 |
| group_results6 | Job-first approach | .043 | 0.031876 | 0.049273 | 0 |
| group_results7 | Job-first with JSON aggregation | .032 | 0.031517 | 0.035283 | 0 |
| group_results8 | Optimized V1: values_list with dict | .038 | 0.026721 | 0.049564 | 0 |
| group_results9 | Optimized V2: only() and iterator() | .037 | 0.028054 | 0.047010 | 0 |
| group_results10 | Optimized V3: Raw SQL from Group table | .037 | 0.024788 | 0.045805 | 0 |
| group_results11 | Optimized with caching | .029 | 0.017807 | 0.037957 | 0 |

## Performance Ranking (by average time)

| Rank | Endpoint | Avg Time (s) |
|------|----------|--------------|
| 1 | group_results11 | .029 |
| 2 | group_results | .032 |
| 3 | group_results7 | .032 |
| 4 | group_results10 | .037 |
| 5 | group_results5 | .037 |
| 6 | group_results9 | .037 |
| 7 | group_results8 | .038 |
| 8 | group_results_legacy | .039 |
| 9 | group_results3 | .041 |
| 10 | group_results6 | .043 |
| 11 | group_results2 | .044 |
| 12 | group_results4 | .054 |

## Raw Timing Data

Detailed timing for each run (in seconds):

### group_results

Runs: 0.026042 0.036656 0.036547 0.029630 0.035708

### group_results_legacy

Runs: 0.032364 0.044448 0.043460 0.027847 0.047701

### group_results2

Runs: 0.030340 0.047561 0.047372 0.048664 0.050786

### group_results3

Runs: 0.029223 0.049291 0.045306 0.037931 0.046509

### group_results4

Runs: 0.043636 0.060383 0.049467 0.056713 0.060978

### group_results5

Runs: 0.026246 0.043371 0.043812 0.040326 0.034332

### group_results6

Runs: 0.031876 0.041601 0.046782 0.047402 0.049273

### group_results7

Runs: 0.031519 0.031517 0.035283 0.033111 0.033016

### group_results8

Runs: 0.026721 0.033494 0.042048 0.042424 0.049564

### group_results9

Runs: 0.028054 0.047010 0.045752 0.034418 0.034260

### group_results10

Runs: 0.024788 0.045805 0.040656 0.032401 0.045568

### group_results11

Runs: 0.023340 0.035122 0.035371 0.017807 0.037957
