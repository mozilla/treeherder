# import newrelic.agent
# from celery import task

# # @task(name='ingest-logs')


# async def handleTaskId(taskId, root_url):
#     asyncQueue = taskcluster.aio.Queue({"rootUrl": root_url}, session=session)
#     results = await asyncio.gather(asyncQueue.status(taskId), asyncQueue.task(taskId))
#     await handleTask({"status": results[0]["status"], "task": results[1],}, root_url)


# async def handleTask(task, root_url):
#     taskId = task["status"]["taskId"]
#     runs = task["status"]["runs"]
#     # If we iterate in order of the runs, we will not be able to mark older runs as
#     # "retry" instead of exception
#     for run in reversed(runs):
#         message = {
#             "exchange": stateToExchange[run["state"]],
#             "payload": {"status": {"taskId": taskId, "runs": runs,}, "runId": run["runId"],},
#             "root_url": root_url,
#         }

#         try:
#             taskRuns = await handleMessage(message, task["task"])
#         except Exception as e:
#             logger.exception(e)

#         if taskRuns:
#             # Schedule and run jobs inside the thread pool executor
#             jobFutures = [
#                 routine_to_future(process_job_with_threads, run, root_url) for run in taskRuns
#             ]
#             await await_futures(jobFutures)


# async def fetchGroupTasks(taskGroupId, root_url):
#     tasks = []
#     query = {}
#     continuationToken = ""
#     asyncQueue = taskcluster.aio.Queue({"rootUrl": root_url}, session=session)
#     while True:
#         if continuationToken:
#             query = {"continuationToken": continuationToken}
#         response = await asyncQueue.listTaskGroup(taskGroupId, query=query)
#         tasks.extend(response["tasks"])
#         continuationToken = response.get("continuationToken")
#         if continuationToken is None:
#             break
#         logger.info("Requesting more tasks. %s tasks so far...", len(tasks))
#     return tasks


# async def processTasks(taskGroupId, root_url):
#     try:
#         tasks = await fetchGroupTasks(taskGroupId, root_url)
#         logger.info("We have %s tasks to process", len(tasks))
#     except Exception as e:
#         logger.exception(e)

#     if not tasks:  # No tasks to process
#         return

#     # Schedule and run tasks inside the thread pool executor
#     taskFutures = [routine_to_future(handleTask, task, root_url) for task in tasks]
#     await await_futures(taskFutures)


# async def routine_to_future(func, *args):
#     """Arrange for a function to be executed in the thread pool executor.
#     Returns an asyncio.Futures object.
#     """

#     def _wrap_coroutine(func, *args):
#         """Wraps a coroutine into a regular routine to be ran by threads."""
#         asyncio.run(func(*args))

#     event_loop = asyncio.get_event_loop()
#     if inspect.iscoroutinefunction(func):
#         return await event_loop.run_in_executor(executor, _wrap_coroutine, func, *args)
#     return await event_loop.run_in_executor(executor, func, *args)


# async def await_futures(fs):
#     """Await for each asyncio.Futures given by fs to copmlete."""
#     for fut in fs:
#         try:
#             await fut
#         except Exception as e:
#             logger.exception(e)
