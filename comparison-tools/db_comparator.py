#!/usr/bin/env python3
"""
Treeherder Database Comparison Tool
Compares database schemas and data between local and staging environments
"""

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor


@dataclass
class TableInfo:
    table_name: str
    column_count: int
    row_count: int
    columns: list[dict[str, Any]]
    indexes: list[str]
    constraints: list[str]


@dataclass
class DatabaseComparison:
    timestamp: str
    local_db_info: dict[str, Any]
    staging_db_info: dict[str, Any]
    schema_differences: list[str]
    table_comparisons: list[dict[str, Any]]
    missing_tables: dict[str, list[str]]
    row_count_differences: list[dict[str, Any]]


class TreeherderDBComparator:
    def __init__(self, local_db_url: str, staging_db_url: str = None):
        self.local_db_url = local_db_url
        self.staging_db_url = staging_db_url

        # Key tables to analyze in detail
        self.key_tables = [
            "repository",
            "repository_group",
            "option_collection",
            "failure_classification",
            "job_type",
            "machine",
            "product",
            "build_platform",
            "machine_platform",
            "performance_framework",
            "performance_signature",
            "push",
            "job",
            "text_log_summary",
            "bug_job_map",
            "classified_failure",
        ]

    def connect_to_db(self, db_url: str) -> psycopg2.extensions.connection:
        """Create database connection"""
        try:
            conn = psycopg2.connect(db_url)
            return conn
        except Exception as e:
            print(f"Error connecting to database: {e}")
            raise

    def get_database_info(self, conn: psycopg2.extensions.connection) -> dict[str, Any]:
        """Get general database information"""
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # Get database version
            cursor.execute("SELECT version();")
            version = cursor.fetchone()["version"]

            # Get database size
            cursor.execute("""
                SELECT pg_size_pretty(pg_database_size(current_database())) as size;
            """)
            size = cursor.fetchone()["size"]

            # Get table count
            cursor.execute("""
                SELECT COUNT(*) as table_count 
                FROM information_schema.tables 
                WHERE table_schema = 'public';
            """)
            table_count = cursor.fetchone()["table_count"]

            # Get total row count estimate
            cursor.execute("""
                SELECT SUM(n_tup_ins - n_tup_del) as estimated_rows
                FROM pg_stat_user_tables;
            """)
            result = cursor.fetchone()
            estimated_rows = result["estimated_rows"] if result["estimated_rows"] else 0

            return {
                "version": version,
                "size": size,
                "table_count": table_count,
                "estimated_rows": estimated_rows,
                "timestamp": datetime.now().isoformat(),
            }

    def get_table_info(
        self, conn: psycopg2.extensions.connection, table_name: str
    ) -> TableInfo | None:
        """Get detailed information about a specific table"""
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Check if table exists
                cursor.execute(
                    """
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = %s
                    );
                """,
                    (table_name,),
                )

                if not cursor.fetchone()["exists"]:
                    return None

                # Get column information
                cursor.execute(
                    """
                    SELECT 
                        column_name,
                        data_type,
                        is_nullable,
                        column_default,
                        character_maximum_length
                    FROM information_schema.columns
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                    ORDER BY ordinal_position;
                """,
                    (table_name,),
                )
                columns = [dict(row) for row in cursor.fetchall()]

                # Get row count
                cursor.execute(f"SELECT COUNT(*) as count FROM {table_name};")
                row_count = cursor.fetchone()["count"]

                # Get indexes
                cursor.execute(
                    """
                    SELECT indexname, indexdef
                    FROM pg_indexes
                    WHERE tablename = %s
                    AND schemaname = 'public';
                """,
                    (table_name,),
                )
                indexes = [row["indexdef"] for row in cursor.fetchall()]

                # Get constraints
                cursor.execute(
                    """
                    SELECT conname, pg_get_constraintdef(oid) as definition
                    FROM pg_constraint
                    WHERE conrelid = %s::regclass;
                """,
                    (table_name,),
                )
                constraints = [
                    f"{row['conname']}: {row['definition']}" for row in cursor.fetchall()
                ]

                return TableInfo(
                    table_name=table_name,
                    column_count=len(columns),
                    row_count=row_count,
                    columns=columns,
                    indexes=indexes,
                    constraints=constraints,
                )

        except Exception as e:
            print(f"Error getting info for table {table_name}: {e}")
            return None

    def compare_table_schemas(self, local_table: TableInfo, staging_table: TableInfo) -> list[str]:
        """Compare schemas of two tables"""
        differences = []

        if not local_table and not staging_table:
            return differences

        if not local_table:
            differences.append(f"Table missing in local: {staging_table.table_name}")
            return differences

        if not staging_table:
            differences.append(f"Table missing in staging: {local_table.table_name}")
            return differences

        # Compare column counts
        if local_table.column_count != staging_table.column_count:
            differences.append(
                f"Column count differs: local={local_table.column_count}, "
                f"staging={staging_table.column_count}"
            )

        # Compare columns
        local_cols = {col["column_name"]: col for col in local_table.columns}
        staging_cols = {col["column_name"]: col for col in staging_table.columns}

        # Missing columns
        missing_in_local = set(staging_cols.keys()) - set(local_cols.keys())
        missing_in_staging = set(local_cols.keys()) - set(staging_cols.keys())

        if missing_in_local:
            differences.append(f"Columns missing in local: {missing_in_local}")
        if missing_in_staging:
            differences.append(f"Columns missing in staging: {missing_in_staging}")

        # Compare column definitions for common columns
        common_cols = set(local_cols.keys()) & set(staging_cols.keys())
        for col_name in common_cols:
            local_col = local_cols[col_name]
            staging_col = staging_cols[col_name]

            if local_col["data_type"] != staging_col["data_type"]:
                differences.append(
                    f"Column {col_name} type differs: "
                    f"local={local_col['data_type']}, staging={staging_col['data_type']}"
                )

            if local_col["is_nullable"] != staging_col["is_nullable"]:
                differences.append(
                    f"Column {col_name} nullable differs: "
                    f"local={local_col['is_nullable']}, staging={staging_col['is_nullable']}"
                )

        # Compare row counts
        if local_table.row_count != staging_table.row_count:
            differences.append(
                f"Row count differs: local={local_table.row_count}, "
                f"staging={staging_table.row_count}"
            )

        return differences

    def get_sample_data(
        self, conn: psycopg2.extensions.connection, table_name: str, limit: int = 5
    ) -> list[dict]:
        """Get sample data from a table"""
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(f"SELECT * FROM {table_name} LIMIT %s;", (limit,))
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            print(f"Error getting sample data from {table_name}: {e}")
            return []

    def run_comparison(self) -> DatabaseComparison:
        """Run complete database comparison"""
        print("Starting database comparison...")

        # Connect to databases
        local_conn = self.connect_to_db(self.local_db_url)

        # For staging, we'll use a read-only approach or skip if not accessible
        staging_conn = None
        if self.staging_db_url:
            try:
                staging_conn = self.connect_to_db(self.staging_db_url)
            except Exception as e:
                print(f"Warning: Cannot connect to staging database: {e}")
                print("Proceeding with local-only analysis...")

        try:
            # Get database info
            local_db_info = self.get_database_info(local_conn)
            staging_db_info = None
            if staging_conn:
                staging_db_info = self.get_database_info(staging_conn)

            print(
                f"Local database: {local_db_info['table_count']} tables, {local_db_info['estimated_rows']} estimated rows"
            )
            if staging_db_info:
                print(
                    f"Staging database: {staging_db_info['table_count']} tables, {staging_db_info['estimated_rows']} estimated rows"
                )

            # Compare key tables
            table_comparisons = []
            schema_differences = []
            missing_tables = {"local": [], "staging": []}
            row_count_differences = []

            for table_name in self.key_tables:
                print(f"Analyzing table: {table_name}")

                local_table = self.get_table_info(local_conn, table_name)
                staging_table = None
                if staging_conn:
                    staging_table = self.get_table_info(staging_conn, table_name)

                # Track missing tables
                if not local_table and staging_table:
                    missing_tables["local"].append(table_name)
                elif local_table and not staging_table:
                    missing_tables["staging"].append(table_name)

                # Compare schemas
                if local_table and staging_table:
                    table_diffs = self.compare_table_schemas(local_table, staging_table)
                    if table_diffs:
                        schema_differences.extend([f"{table_name}: {diff}" for diff in table_diffs])

                    # Track significant row count differences
                    if local_table.row_count != staging_table.row_count:
                        diff_pct = 0
                        if staging_table.row_count > 0:
                            diff_pct = (
                                abs(local_table.row_count - staging_table.row_count)
                                / staging_table.row_count
                                * 100
                            )

                        row_count_differences.append(
                            {
                                "table": table_name,
                                "local_count": local_table.row_count,
                                "staging_count": staging_table.row_count,
                                "difference": local_table.row_count - staging_table.row_count,
                                "difference_percent": diff_pct,
                            }
                        )

                # Store table comparison
                table_comparison = {
                    "table_name": table_name,
                    "local": asdict(local_table) if local_table else None,
                    "staging": asdict(staging_table) if staging_table else None,
                    "differences": self.compare_table_schemas(local_table, staging_table)
                    if local_table and staging_table
                    else [],
                }
                table_comparisons.append(table_comparison)

            return DatabaseComparison(
                timestamp=datetime.now().isoformat(),
                local_db_info=local_db_info,
                staging_db_info=staging_db_info,
                schema_differences=schema_differences,
                table_comparisons=table_comparisons,
                missing_tables=missing_tables,
                row_count_differences=row_count_differences,
            )

        finally:
            local_conn.close()
            if staging_conn:
                staging_conn.close()

    def generate_report(self, comparison: DatabaseComparison, output_file: str = None):
        """Generate comparison report"""
        report = asdict(comparison)

        if output_file:
            with open(output_file, "w") as f:
                json.dump(report, f, indent=2, default=str)
            print(f"\nDetailed report saved to: {output_file}")

        # Print summary
        print("\n" + "=" * 60)
        print("DATABASE COMPARISON SUMMARY")
        print("=" * 60)

        if comparison.staging_db_info:
            print(f"Local tables: {comparison.local_db_info['table_count']}")
            print(f"Staging tables: {comparison.staging_db_info['table_count']}")
            print(f"Schema differences: {len(comparison.schema_differences)}")
            print(f"Missing in local: {len(comparison.missing_tables['local'])}")
            print(f"Missing in staging: {len(comparison.missing_tables['staging'])}")
            print(f"Row count differences: {len(comparison.row_count_differences)}")
        else:
            print(f"Local database analyzed: {comparison.local_db_info['table_count']} tables")
            print("Staging database: Not accessible")

        # Show problematic areas
        if comparison.schema_differences:
            print(f"\nSCHEMA DIFFERENCES ({len(comparison.schema_differences)}):")
            for diff in comparison.schema_differences[:10]:  # Show first 10
                print(f"  {diff}")
            if len(comparison.schema_differences) > 10:
                print(f"  ... and {len(comparison.schema_differences) - 10} more")

        if comparison.row_count_differences:
            print("\nSIGNIFICANT ROW COUNT DIFFERENCES:")
            for diff in comparison.row_count_differences:
                if diff["difference_percent"] > 10:  # Show only >10% differences
                    print(
                        f"  {diff['table']}: {diff['local_count']} vs {diff['staging_count']} "
                        f"({diff['difference_percent']:.1f}% diff)"
                    )

        return report


def main():
    parser = argparse.ArgumentParser(description="Compare Treeherder database schemas and data")
    parser.add_argument(
        "--local-db",
        required=True,
        help="Local database URL (e.g., postgresql://user:pass@localhost:5432/treeherder)",
    )
    parser.add_argument("--staging-db", help="Staging database URL (optional)")
    parser.add_argument("--output", "-o", help="Output file for detailed report (JSON format)")
    parser.add_argument(
        "--tables", nargs="+", help="Specific tables to compare (default: predefined key tables)"
    )

    args = parser.parse_args()

    comparator = TreeherderDBComparator(args.local_db, args.staging_db)

    if args.tables:
        comparator.key_tables = args.tables

    try:
        comparison = comparator.run_comparison()
        report = comparator.generate_report(comparison, args.output)

        # Exit with error code if there are significant differences
        has_issues = (
            len(comparison.schema_differences) > 0
            or len(comparison.missing_tables["local"]) > 0
            or len(comparison.missing_tables["staging"]) > 0
            or any(diff["difference_percent"] > 10 for diff in comparison.row_count_differences)
        )

        if has_issues:
            sys.exit(1)

    except Exception as e:
        print(f"Database comparison failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
