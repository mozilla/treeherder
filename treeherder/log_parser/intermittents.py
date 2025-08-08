import datetime

from treeherder.model.models import Group, GroupStatus, Job, JobLog, Push


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
    extra_jobs = JobLog.objects.filter(
        job__push__id__range=(push_ids[-1], push_ids[0]),
        job__push__repository__id=current_job.repository.id,
        job__job_type__name=current_job.job_type.name,
        job__failure_classification_id__in=[1, 6],
        status__in=(1, 2, 3),  # ignore pending
        job__result__in=[
            "busted",
            "testfailed",
            "exception",
            "success",
        ],  # primarily ignore retry/usercancel
    ).values(
        "job__id",
        "job__result",
        "job__failure_classification_id",
    )

    if len(extra_jobs) == 0:
        return

    # ensure 50% 'success' rate
    # success here means the task ran and produced groups | is success
    # jobs without groups (like marionette) will still get tallied properly here
    extra_failed = []
    for job in extra_jobs:
        if job["job__id"] not in job_ids and job["job__result"] != "success":
            extra_failed.append(job)

    # look for failure rate > 50% and exit early
    if len(extra_failed) / len(extra_jobs) > 0.5:
        return

    # any extra_jobs will be failures without groups (infra/timeout/etc.)
    # theoretically there could be many jobs here
    # mark extra_jobs as `intermittent_needs_classification`
    for job in extra_failed:
        if job["job__failure_classification_id"] not in [4, 8]:
            Job.objects.filter(id=job["job__id"]).update(failure_classification_id=8)


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
            .values("id")
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
        .values(
            "name",
            "job_logs__job__id",
            "group_result__status",
            "job_logs__job__job_type__name",
            "job_logs__job__push__id",
        )
        .order_by("-job_logs__job__push__id")
    )

    # If no groups, look for infra
    distinct_job_ids = list(set([f["job_logs__job__id"] for f in all_groups]))
    if len(distinct_job_ids) == 1:
        return _check_and_mark_infra(current_job, distinct_job_ids, ids)

    mappings = {}
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
        current_data = []
        for id in mappings.keys():
            all_data.extend(
                [mappings[id]["groups"][group][j] for j in mappings[id]["groups"].get(group, {})]
            )
            if id == current_job.push.id:
                current_data.extend(
                    [
                        mappings[id]["groups"][group][j]
                        for j in mappings[id]["groups"].get(group, {})
                    ]
                )

        # if new data changes results, update
        pass_rate = len([s for s in all_data if s == GroupStatus.OK]) / len(all_data)
        if pass_rate >= 0.5:
            changed_groups[group] = True
        pass_rate = len([s for s in current_data if s == GroupStatus.OK]) / len(current_data)
        if pass_rate >= 0.5:
            current_changed_groups[group] = True

    # all changed_groups need to be evaluated on previous 'failed' jobs to ensure all groups in that task are 'passing'
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
                target_job = Job.objects.filter(id=job)

                if target_job[0].result != "success" and target_job[
                    0
                ].failure_classification_id not in [4, 8]:
                    target_job.update(failure_classification_id=8)

    return _check_and_mark_infra(current_job, distinct_job_ids, ids)
