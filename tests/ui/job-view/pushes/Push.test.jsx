import { PushClass } from '../../../../ui/job-view/pushes/Push';

describe('Push', () => {
  describe('getJobCount', () => {
    it('returns counts including unscheduled jobs', () => {
      const push = new PushClass({ push: { id: 1 } });

      const jobList = [
        {
          id: 1,
          state: 'unscheduled',
          result: 'unknown',
          failure_classification_id: 1,
        },
        {
          id: 2,
          state: 'unscheduled',
          result: 'unknown',
          failure_classification_id: 1,
        },
        {
          id: 3,
          state: 'unscheduled',
          result: 'unknown',
          failure_classification_id: 1,
        },
        {
          id: 4,
          state: 'unscheduled',
          result: 'unknown',
          failure_classification_id: 1,
        },
        {
          id: 5,
          state: 'unscheduled',
          result: 'unknown',
          failure_classification_id: 1,
        },
        {
          id: 6,
          state: 'pending',
          result: 'unknown',
          failure_classification_id: 1,
        },
        {
          id: 7,
          state: 'pending',
          result: 'unknown',
          failure_classification_id: 1,
        },
        {
          id: 8,
          state: 'pending',
          result: 'unknown',
          failure_classification_id: 1,
        },
        {
          id: 9,
          state: 'pending',
          result: 'unknown',
          failure_classification_id: 1,
        },
        {
          id: 10,
          state: 'running',
          result: 'unknown',
          failure_classification_id: 1,
        },
        {
          id: 11,
          state: 'running',
          result: 'unknown',
          failure_classification_id: 1,
        },
        {
          id: 12,
          state: 'running',
          result: 'unknown',
          failure_classification_id: 1,
        },
        {
          id: 13,
          state: 'completed',
          result: 'success',
          failure_classification_id: 1,
        },
        {
          id: 14,
          state: 'completed',
          result: 'success',
          failure_classification_id: 1,
        },
        {
          id: 15,
          state: 'completed',
          result: 'superseded',
          failure_classification_id: 1,
        },
        {
          id: 16,
          state: 'completed',
          result: 'success',
          failure_classification_id: 2,
        },
      ];

      const counts = push.getJobCount(jobList);

      expect(counts).toHaveProperty('unscheduled');
      expect(counts.unscheduled).toBe(5);
      expect(counts.pending).toBe(4);
      expect(counts.running).toBe(3);
      expect(counts.completed).toBe(3); // 2 with class=1 + 1 with class=2 (superseded excluded)
      expect(counts.fixedByCommit).toBe(1);
    });

    it('initializes unscheduled count to 0 when no jobs', () => {
      const push = new PushClass({ push: { id: 1 } });

      const counts = push.getJobCount([]);

      expect(counts.unscheduled).toBe(0);
      expect(counts.pending).toBe(0);
      expect(counts.running).toBe(0);
      expect(counts.completed).toBe(0);
    });
  });
});
