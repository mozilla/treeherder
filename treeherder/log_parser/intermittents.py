from treeherder.model.models import Group, GroupStatus, Job, Push

# TODO: test
# - p1:t1: fail on g1, p2:t1: pass on g1 - result: p1:t1: intermittent
# - p1:t1: fail on leak (all groups pass), p2:t1: pass - result p1:t1: still default
# - p1:t1: fail on g1, p1:t1.2: pass on g1 - result p1:t1: intermittent
# - p1:t1: fail on g1, p1:t1-cf: pass on g1 - result p1:t1: intermittent
# - p1:t1: fail on g1, p1:t1-cf: fail on g1 - result p1:t1: still default


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
        # get list of pushes
        ids = Push.objects.filter(repository__id=current_job.repository.id).values("id")[:20]

    all_groups = (
        Group.objects.filter(
            job_logs__job__push__id__in=ids,
            job_logs__job__push__repository__id=current_job.repository.id,
            job_logs__job__job_type__name__startswith=jtname,
            job_logs__job__failure_classification__id__in=[
                1,
                4,
                6,
            ],  # not classified, intermittent, new_failure;  TODO: consider 7 == autoclassified
            job_logs__job__result__in=[
                "success",
                "testfailed",
            ],  # primarily ignore retry/usercancel
            group_result__status__in=[GroupStatus.OK, GroupStatus.ERROR],
        )
        .values(
            "name",
            "job_logs__job__id",
            "group_result__status",
            "job_logs__job__job_type__name",
            "job_logs__job__push__id",
        )
        .order_by("-job_logs__job__push__time")
    )

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
    # TODO: handle new regressions - historical rate might be broken, then we need to wait for more future data
    changed_groups = {}
    for group in mappings[current_job.push.id]["groups"]:
        all_data = []
        for id in mappings.keys():
            all_data.extend(
                [mappings[id]["groups"][group][j] for j in mappings[id]["groups"].get(group, {})]
            )

        # if new data changes results, update
        pass_rate = len([s for s in all_data if s == GroupStatus.OK]) / len(all_data)
        if pass_rate >= 0.5:
            changed_groups[group] = True

    # all changed_groups need to be evaluated on previous 'failed' jobs to ensure all groups in that task are 'passing'
    for id in mappings.keys():
        if id == current_job.push.id and len(ids) > 1:
            continue

        for job in mappings[id]["jobs"]:
            if job == job_id:
                # current job will need future data to turn green
                continue

            all_green = True
            for group in mappings[id]["jobs"][job]:
                # if group changed to failing and group originally failed
                if (
                    mappings[id]["groups"][group][job] == GroupStatus.ERROR
                    and group not in changed_groups
                ):
                    all_green = False

            if all_green:
                target_job = Job.objects.filter(id=job)

                # edge case is all groups originally pass and then shutdown leaks cause 'testfailed'.
                # also we ignore infra/leaks that don't report group failures in errorsummary files
                if (
                    target_job[0].result != "success"
                    and target_job[0].failure_classification_id != 4
                ):
                    target_job.update(failure_classification_id=4)
