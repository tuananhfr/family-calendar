package vn.lichgiadinh.screentime;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public final class SyncJob extends JobService {
    private static final int JOB_ID = 4109;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private Future<?> task;
    static void schedule(Context context) {
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        ComponentName service = new ComponentName(context, SyncJob.class);
        JobInfo existing = scheduler.getPendingJob(JOB_ID);
        // Rendering/opening the app must not restart the 15-minute countdown or cancel a running sync.
        if (existing != null && existing.isPeriodic() && existing.getIntervalMillis() == 15 * 60_000L
                && service.equals(existing.getService())) return;
        // No network constraint: a run without network still observes a permission withdrawal.
        scheduler.schedule(new JobInfo.Builder(JOB_ID, service)
                .setPeriodic(15 * 60_000L).setPersisted(true).setBackoffCriteria(60_000, JobInfo.BACKOFF_POLICY_EXPONENTIAL).build());
    }
    static void cancel(Context context) { context.getSystemService(JobScheduler.class).cancel(JOB_ID); }
    @Override public boolean onStartJob(JobParameters params) {
        task = executor.submit(() -> {
            boolean retry = false;
            try { new Collector(this).sync(); }
            catch (Exception error) { retry = true; }
            if (!Thread.currentThread().isInterrupted()) jobFinished(params, retry);
        });
        return true;
    }
    @Override public boolean onStopJob(JobParameters params) { if (task != null) task.cancel(true); return true; }
    @Override public void onDestroy() { executor.shutdownNow(); super.onDestroy(); }
}
