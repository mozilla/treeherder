import datetime

from treeherder.model.models import Group, GroupStatus, Job, Push, TextLogError


def classify(jobs_to_classify, jobs_to_unclassify):
    # TODO: consider job.result=(busted, exception)
    if jobs_to_classify:
        target_jobs = Job.objects.filter(
            id__in=jobs_to_classify, result="testfailed", failure_classification_id__in=[1, 6]
        )
        if target_jobs:
            target_jobs.update(failure_classification_id=8)

    if jobs_to_unclassify:
        # TODO: query text_log_error for new_failure and use 6 if previously set
        new_jobs = (
            TextLogError.objects.filter(
                job__id__in=jobs_to_unclassify, new_failure=True, job__failure_classification_id=8
            )
            .values("job__id")
            .distinct()
        )
        jobs_to_newfailure = [j["job__id"] for j in new_jobs]
        jobs_to_regular_failure = list(set(jobs_to_unclassify) - set(jobs_to_newfailure))

        # classification_id: 6 == new failure needs classification, 1 == no classified
        if jobs_to_newfailure:
            target_jobs = Job.objects.filter(id__in=jobs_to_newfailure, result="testfailed")
            if target_jobs:
                target_jobs.update(failure_classification_id=6)
        if jobs_to_regular_failure:
            target_jobs = Job.objects.filter(id__in=jobs_to_regular_failure, result="testfailed")
            if target_jobs:
                target_jobs.update(failure_classification_id=1)


def _check_and_mark_infra(current_job, job_ids, push_ids):
    """
    current_job - Job object of incoming job we are parsing
    job_ids - list of all job_ids found in previous query
    push_ids - ids of pushes we care about from previous query
    """
    if current_job.result != "success":
        # if new job is broken, then only look on same push
        # otherwise it could be a new failure.
        push_ids = [current_job.push.id]

    # look for all jobs in pushids matching current_job.job_type.name
    # if older are failing for "infra", then ensure same job is passing
    #  if so mark as intermittent
    extra_jobs = (
        Job.objects.filter(
            push__id__range=(push_ids[-1], push_ids[0]),
            repository__id=current_job.repository.id,
            job_type__name=current_job.job_type.name,
            failure_classification_id__in=[1, 6, 8],
            job_log__status__in=[1, 3],  # ignore pending, failed
            state="completed",  # ignore running/pending
            result__in=[
                "busted",
                "testfailed",
                "exception",
                "success",
            ],  # primarily ignore retry/usercancel
        )
        .values(
            "id",
            "result",
            "failure_classification_id",
        )
        .distinct("id")
    )

    # ignore previous classified, we are looking for NEW extra jobs
    if len([ej for ej in extra_jobs if ej["failure_classification_id"] != 8]) == 0:
        return [], []

    # ensure 50% 'success' rate
    # success here means the task ran and produced groups | is success
    # jobs without groups (like marionette) will still get tallied properly here
    extra_failed = []
    for job in extra_jobs:
        if job["id"] not in job_ids and job["result"] != "success":
            extra_failed.append(job)

    jobs_to_classify = []
    jobs_to_unclassify = []

    # look for failure rate > 50% and exit early
    if len(extra_failed) / len(extra_jobs) > 0.5:
        # as failure rate > 50%, if any jobs are fc_id=8 classify as fc_id=1
        for job in extra_failed:
            if job["failure_classification_id"] == 8:
                jobs_to_unclassify.append(job["id"])

    # any extra_jobs will be failures without groups (infra/timeout/etc.)
    # theoretically there could be many jobs here
    # mark extra_jobs as `intermittent_needs_classification`
    for job in extra_failed:
        if job["failure_classification_id"] not in [4, 8]:
            jobs_to_classify.append(job["id"])

    return jobs_to_classify, jobs_to_unclassify


def check_and_mark_intermittent(job_id):
    current_job = Job.objects.get(id=job_id)
    jtname = current_job.job_type.name.strip("-cf")
    ids = [current_job.push.id]

    try:
        _ = int(jtname.split("-")[-1])
        jtname = "-".join(jtname.split("-")[:-1])
    except ValueError:
        pass

    # if we are not on try, look at recent history
    if current_job.repository.id != 4:
        start_date = current_job.push.time - datetime.timedelta(hours=36)

        # get list of pushes, find the current push and recent pushes
        idlist = (
            Push.objects.filter(repository__id=current_job.repository.id, time__gte=start_date)
            .values_list("id", flat=True)
            .order_by("-id")
        )
        counter = -1
        for id in idlist:
            if id == current_job.push.id:
                counter = 0
                continue
            if counter < 0:
                continue
            if current_job.repository.id == 77 and counter >= 20:
                break
            elif current_job.repository.id != 77 and counter >= 3:
                break
            ids.append(id)
            counter += 1

    all_groups = (
        Group.objects.filter(
            job_logs__job__push__id__range=(ids[-1], ids[0]),
            job_logs__job__push__repository__id=current_job.repository.id,
            job_logs__job__job_type__name__startswith=jtname,
            job_logs__job__failure_classification__id__in=[
                1,
                4,
                6,
                8,
            ],  # not classified, intermittent, new_failure, intermittent needs bug; TODO: consider 7 == autoclassified
            job_logs__job__result__in=[
                "success",
                "testfailed",
            ],  # primarily ignore retry/usercancel/unknown
            group_result__status__in=[GroupStatus.OK, GroupStatus.ERROR],
        )
        .exclude(name__exact="")
        .values(
            "name",
            "job_logs__job__id",
            "group_result__status",
            "job_logs__job__job_type__name",
            "job_logs__job__push__id",
            "job_logs__job__failure_classification__id",
        )
        .order_by("-job_logs__job__push__id")
    )

    # If no groups, look for infra
    distinct_job_ids = list(set([f["job_logs__job__id"] for f in all_groups]))
    if len(distinct_job_ids) == 1:
        to_classify, to_unclassify = _check_and_mark_infra(current_job, distinct_job_ids, ids)
        return classify(to_classify, to_unclassify)

    mappings = {}
    job_classifications = {}
    for item in all_groups:
        jobname = item["job_logs__job__job_type__name"].strip("-cf")
        try:
            int(jobname.split("-")[-1])
            jobname = "-".join(jobname.split("-")[:-1])
        except ValueError:
            pass

        if jobname != jtname:
            # we have a variant
            continue

        # TODO: consider storing a list of job.id that are fc_id=8
        # store job:fc_id so we can reference what needs changed
        if item["job_logs__job__id"] not in job_classifications:
            job_classifications[item["job_logs__job__id"]] = item[
                "job_logs__job__failure_classification__id"
            ]

        if item["job_logs__job__push__id"] not in mappings:
            mappings[item["job_logs__job__push__id"]] = {"groups": {}, "jobs": {}}
            groups = mappings[item["job_logs__job__push__id"]]["groups"]
            jobs = mappings[item["job_logs__job__push__id"]]["jobs"]

        if item["name"] not in groups:
            groups[item["name"]] = {}
        if item["job_logs__job__id"] not in groups[item["name"]]:
            groups[item["name"]][item["job_logs__job__id"]] = item["group_result__status"]

        if item["job_logs__job__id"] not in jobs:
            jobs[item["job_logs__job__id"]] = {}
        if item["name"] not in jobs[item["job_logs__job__id"]]:
            jobs[item["job_logs__job__id"]][item["name"]] = item["group_result__status"]

    # multi push support - want to look back in history now that we have "future" data
    # a previous job can only change if ALL failing groups have future passing data
    #
    # current job has new data, lets find all groups that changed status as a result of new data
    # if no groups, possibly an "infra" error
    changed_groups = {}
    current_changed_groups = {}
    for group in mappings.get(current_job.push.id, {}).get("groups", []):
        all_data = []
        current_data = [
            mappings[current_job.push.id]["groups"][group][j]
            for j in mappings[current_job.push.id]["groups"][group]
        ]
        for id in mappings.keys():
            all_data.extend(
                [mappings[id]["groups"][group][j] for j in mappings[id]["groups"].get(group, {})]
            )

        # if new data changes results, update
        pass_rate = len([s for s in all_data if s == GroupStatus.OK]) / len(all_data)
        if pass_rate >= 0.5:
            changed_groups[group] = True
        pass_rate = len([s for s in current_data if s == GroupStatus.OK]) / len(current_data)
        if pass_rate >= 0.5:
            current_changed_groups[group] = True

    # all changed_groups need to be evaluated on previous 'failed' jobs to ensure all groups in that task are 'passing'
    jobs_to_classify = []  # mark as fcid=8 (known intermittent)
    jobs_to_unclassify = []  # previously parked as fcid=8, new failing data, now fcid=1
    for id in mappings.keys():
        for job in mappings[id]["jobs"]:
            all_green = True
            current_all_green = True
            for group in mappings[id]["jobs"][job]:
                # if group changed to failing and group originally failed
                if (
                    mappings[id]["groups"][group][job] == GroupStatus.ERROR
                    and group not in changed_groups
                ):
                    all_green = False
                if (
                    mappings[id]["groups"][group][job] == GroupStatus.ERROR
                    and group not in current_changed_groups
                ):
                    current_all_green = False

            if (id == current_job.push.id and current_all_green) or (
                id != current_job.push.id and len(ids) > 1 and all_green
            ):
                jobs_to_classify.append(job)
            elif job_classifications[job] == 8:
                jobs_to_unclassify.append(job)

    to_classify, to_unclassify = _check_and_mark_infra(current_job, distinct_job_ids, ids)
    jobs_to_classify.extend(to_classify)
    jobs_to_unclassify.extend(to_unclassify)
    return classify(jobs_to_classify, jobs_to_unclassify)
