# Data retention policies

## On Perfherder

On a daily basis, Perfherder expires data for several reasons:

* data provides less value as it grows older
* data accumulates very fast (>1 million new data points are ingested daily)
* query latency degrades in time
* database is rather limited (in terms of storage capacity & scalability)

To ensure persistence of the most relevant performance data, Perfherder' s cycling algorithm takes a more aggressive approach towards the less relevant one. It employs multiple expiring strategies, each one specialized on deleting specific sets of data.

Basically, not all data is deleted in the same way. Some data sets can be kept for longer time than others.

Data targeted for removal includes:

* data points
* series (AKA performance signatures; they collect data points sharing same characteristics)
* alerts
* alert summaries

Generally, the daily cycling starts by removing data points first, using all of its defined strategies. Then it continues with removing series, alerts & alert summaries using a garbage collection approach.

### Cycling strategies

All following strategies target the `performance_datum` table, which stores the performance data points.

#### Generic

Removes data points older than 3 years.

#### Try data

Removes data points originating from try pushes, that are older than 2 years.

#### Not actively sheriffed

Removes data points from repositories other than autoland, mozilla-central, mozilla-beta, fenix & reference-browser, which are older than 6 months. Data from try is exempt, as it's handled by the try data strategy above.

### Garbage collection

Removes alert summaries which no longer has any alerts linked to them.

This kind of data pertains to the `performance_alert_summary` table.
