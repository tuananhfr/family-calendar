package vn.lichgiadinh.screentime;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Pure event reducer. Foreground per package; union for device total; no unlock inference. */
public final class UsageTimeline {
    public static final int RESUME = 1, PAUSE = 2, SCREEN_ON = 15, SCREEN_OFF = 16, SHUTDOWN = 26;
    public record Event(long at, int type, String pkg, String activity) {}
    public record Result(Map<String, Long> appMillis, long deviceMillis, boolean partial) {}

    public static Result reduce(List<Event> input, long from, long until, long now) {
        if (until < from) throw new IllegalArgumentException("Negative observation window");
        List<Event> events = new ArrayList<>(input);
        events.sort(Comparator.comparingLong(Event::at));
        Map<String, String> active = new HashMap<>();
        Map<String, Long> durations = new HashMap<>();
        boolean screenOn = false, screenKnown = false, partial = false;
        long cursor = from, total = 0;
        for (Event event : events) {
            if (event.at > now) { partial = true; continue; }
            long point = Math.max(from, Math.min(until, event.at));
            if (point > cursor) {
                if (!screenKnown) partial = true;
                if (screenKnown && screenOn && !active.isEmpty()) {
                    long delta = point - cursor;
                    total += delta;
                    for (String pkg : new HashSet<>(active.values())) durations.merge(pkg, delta, Long::sum);
                }
                cursor = point;
            }
            if (event.at > until) continue;
            String key = event.pkg + "/" + event.activity;
            if (event.type == SCREEN_ON) { screenOn = true; screenKnown = true; }
            else if (event.type == SCREEN_OFF || event.type == SHUTDOWN) {
                screenOn = false; screenKnown = true; active.clear();
                if (event.type == SHUTDOWN && event.at >= from) partial = true;
            } else if (event.type == RESUME && event.pkg != null) {
                if (active.put(key, event.pkg) != null && event.at >= from) partial = true;
                // A resumed activity supplies evidence of interaction, even without a preceding screen event.
                if (!screenKnown) { screenOn = true; screenKnown = true; if (event.at > from) partial = true; }
            } else if (event.type == PAUSE) {
                if (active.remove(key) == null && event.at > from) partial = true;
            }
        }
        if (cursor < until) {
            if (!screenKnown) partial = true;
            if (screenKnown && screenOn && !active.isEmpty()) {
                long delta = until - cursor; total += delta;
                for (String pkg : new HashSet<>(active.values())) durations.merge(pkg, delta, Long::sum);
                // Historical windows with an unclosed session cannot be considered complete.
                partial = true;
            }
        }
        return new Result(durations, total, partial);
    }
    private UsageTimeline() {}
}
