# Data retention policies

## On Perfherder

On a daily basis, Perfherder expires data out of several reasons:

* data provides lower & lower interest as it grows older
* data accumulates very fast (>1 million new data points are ingested daily)
* query latency degrades in time, down to intermittent timeouts
* database is rather limited (in terms of storage capacity & scalability)

To ensure persistence of the most relevant performance data, Perfherder's cycling algorithm takes a more aggressive approach towards the less relevant one. It employs multiple expiring strategies, each one specialized on deleting specific sets of data.

Basically, not all data is deleted in the same way. Some data sets can be kept for longer time than others.

Data targeted for removal includes:

* data points
* series (AKA performance signatures; they collect data points sharing same characteristis)
* alerts
* alert summaries

Generally, the daily cycling starts by removing data points first, using its defined strategies. Then it continues with removing series, alerts & alert summaries using a garbage collection approach.

### Cycling strategies

All following strategies target the `performance_datum` table, holding the performance data points.

#### Generic

Removes data points older than 1 year.

#### Try data

Removes data points originating from try pushes, that are older than 6 weeks.

#### Not actively sheriffed

Removes data points from repositories other than autoland, mozilla-central, mozilla-beta, fenix & reference-browser, which are older than 6 months.

#### Stalled data

Removes data points from series which haven't been ingesting new ones for the last 4 months.

### Garbage collection

Removes series which no longer have any data points linked to them. This cascades to the linked alerts, as they don't make sense without a parent series.

Removes alert summaries which no longer have any alerts linked to them.

These kinds of data pertain to the `performance_signature`, `performance_alert` & `performance_alert_summary` table respectively.
