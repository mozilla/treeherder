# Treeherder group_results API Performance Test Results

**Test Date:** 2025-08-28 01:27:58  
**Test Environment:** Local Docker  
**Base URL:** <http://localhost:8000/api>  
**Project:** autoland  
**Test Revision:** 95166f5b2a85db5652bc134b51d3d43a3455a26c  
**Number of Runs per Endpoint:** 5  
**Database State:** Before index migration

## Summary

This test measures the performance of all group_results API endpoints in Treeherder.
Each endpoint was called 5 times with the same revision to measure response times.

## Results

| Endpoint | Description | Avg Time (s) | Min Time (s) | Max Time (s) | Std Dev (s) | Response Size (KB) | Status |
|----------|-------------|-------------|--------------|--------------|-------------|-------------------|--------|
| group_results (PRIMARY/OPTIMIZED) | Primary optimized endpoint with Redis caching (5-min TTL) | N/A | N/A | N/A | N/A | N/A | ❌ Failed |
| group_results_legacy | Legacy implementation - no optimizations | N/A | N/A | N/A | N/A | N/A | ❌ Failed |
| group_results2 | Using get_group_results_new with push.id | N/A | N/A | N/A | N/A | N/A | ❌ Failed |
| group_results3 | Using get_group_results_new_fast_dict | N/A | N/A | N/A | N/A | N/A | ❌ Failed |
| group_results4 | Using get_group_results_new_orm | N/A | N/A | N/A | N/A | N/A | ❌ Failed |
| group_results5 | Direct SQL without ORM overhead | N/A | N/A | N/A | N/A | N/A | ❌ Failed |
| group_results6 | Job-first approach | N/A | N/A | N/A | N/A | N/A | ❌ Failed |
| group_results7 | Job-first with JSON aggregation | N/A | N/A | N/A | N/A | N/A | ❌ Failed |
| group_results8 | Optimized V1: values_list with dict | N/A | N/A | N/A | N/A | N/A | ❌ Failed |
| group_results9 | Optimized V2: only() and iterator() | N/A | N/A | N/A | N/A | N/A | ❌ Failed |
| group_results10 | Optimized V3: Raw SQL from Group table | N/A | N/A | N/A | N/A | N/A | ❌ Failed |
| group_results11 | Optimized with caching | N/A | N/A | N/A | N/A | N/A | ❌ Failed |

## Performance Ranking (by average time)

| Rank | Endpoint | Avg Time (s) | Improvement vs Legacy |
|------|----------|--------------|----------------------|

## Raw Timing Data

Detailed timing for each run (in seconds):
