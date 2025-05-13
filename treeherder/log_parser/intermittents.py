from treeherder.model.models import Group, GroupStatus, Job


def check_and_mark_intermittent(job_id):
    current_job = Job.objects.get(id=job_id)

    if current_job.job_type.name.endswith("-cf"):
        jtname = [current_job.job_type.name, current_job.job_type.name.strip("-cf")]
    else:
        jtname = [current_job.job_type.name, f"{current_job.job_type.name}-cf"]

    all_groups = Group.objects.filter(
        job_logs__job__push__id=current_job.push.id,
        job_logs__job__job_type__name__in=jtname,
        group_result__status__in=[GroupStatus.OK, GroupStatus.ERROR],
    ).values(
        "name",
        "job_logs__job__id",
        "group_result__status",
    )

    groups = {}
    jobs = {}
    for item in all_groups:
        if item["name"] not in groups:
            groups[item["name"]] = {}
        if item["job_logs__job__id"] not in groups[item["name"]]:
            groups[item["name"]][item["job_logs__job__id"]] = item["group_result__status"]

        if item["job_logs__job__id"] not in jobs:
            jobs[item["job_logs__job__id"]] = {}
        if item["name"] not in jobs[item["job_logs__job__id"]]:
            jobs[item["job_logs__job__id"]][item["name"]] = item["group_result__status"]

    if len(jobs.keys()) <= 1:
        # zero jobs == no groups reported (i.e. marionette)
        # 1 job == no additional data
        return

    for job in jobs.keys():
        # for each similar task.label, ensure all groups have >=50% pass rate, if so flag failing
        # job as intermittent.  for non test failures, ensure all groups are green
        all_green = True
        failed_groups = [g for g in jobs[job] if int(jobs[job][g]) == GroupStatus.ERROR]
        for group in failed_groups:
            all_status = [groups[group][j] for j in groups[group]]
            pass_rate = len([s for s in all_status if s == GroupStatus.OK]) / len(all_status)
            if pass_rate < 0.5:
                all_green = False
                break

        target_job = Job.objects.filter(id=job)

        if all_green and target_job[0].result != "success":
            target_job.update(failure_classification_id=4)
