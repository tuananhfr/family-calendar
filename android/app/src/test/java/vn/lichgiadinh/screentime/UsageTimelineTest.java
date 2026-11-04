package vn.lichgiadinh.screentime;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.List;

public class UsageTimelineTest {
    private UsageTimeline.Event event(long at, int type, String pkg) { return new UsageTimeline.Event(at, type, pkg, "activity"); }

    @Test public void thirtyMinutesForeground() {
        var result = UsageTimeline.reduce(List.of(event(0, 15, null), event(0, 1, "app.a"), event(1800000, 2, "app.a")), 0, 1800000, 1800000);
        assertEquals(1800000, result.deviceMillis()); assertEquals(Long.valueOf(1800000), result.appMillis().get("app.a")); assertFalse(result.partial());
    }
    @Test public void overlappingAppsDoNotDoubleCountDevice() {
        var result = UsageTimeline.reduce(List.of(event(0, 15, null), event(0, 1, "app.a"), event(0, 1, "app.b"), event(600000, 2, "app.a"), event(600000, 2, "app.b")), 0, 600000, 600000);
        assertEquals(600000, result.deviceMillis()); assertEquals(1200000, result.appMillis().values().stream().mapToLong(Long::longValue).sum());
    }
    @Test public void splitsAcrossMidnightByClipping() {
        var events = List.of(event(0, 15, null), event(0, 1, "app.a"), event(1200000, 2, "app.a"));
        assertEquals(600000, UsageTimeline.reduce(events, 0, 600000, 1200000).deviceMillis());
        assertEquals(600000, UsageTimeline.reduce(events, 600000, 1200000, 1200000).deviceMillis());
    }
    @Test public void unknownAndMissingEndArePartial() {
        assertTrue(UsageTimeline.reduce(List.of(), 0, 600000, 600000).partial());
        assertTrue(UsageTimeline.reduce(List.of(event(0, 15, null), event(0, 1, "app.a")), 0, 600000, 600000).partial());
    }
    @Test public void screenOffStopsCounting() {
        var result = UsageTimeline.reduce(List.of(event(0, 15, null), event(0, 1, "app.a"), event(600000, 16, null)), 0, 1200000, 1200000);
        assertEquals(600000, result.deviceMillis());
    }
    @Test public void multipleActivitiesInOneAppAreCountedOnce() {
        var result = UsageTimeline.reduce(List.of(event(0, 15, null), new UsageTimeline.Event(0, 1, "app.a", "one"), new UsageTimeline.Event(0, 1, "app.a", "two"), event(600000, 16, null)), 0, 600000, 600000);
        assertEquals(Long.valueOf(600000), result.appMillis().get("app.a"));
    }
}
