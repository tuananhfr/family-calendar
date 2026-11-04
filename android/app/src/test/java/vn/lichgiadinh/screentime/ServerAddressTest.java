package vn.lichgiadinh.screentime;

import org.junit.Test;
import static org.junit.Assert.*;

public class ServerAddressTest {
    @Test public void httpsWorksInBothBuildsWithSubPath() throws Exception {
        for (boolean debug : new boolean[]{true, false}) {
            assertEquals("https://example.com/lich-gia-dinh/api/v1",
                    ServerAddress.validate(" https://example.com/lich-gia-dinh/api/v1/ ", debug));
        }
    }

    @Test public void usbHttpOnlyWorksInDebug() throws Exception {
        for (String host : new String[]{"localhost", "127.0.0.1"}) {
            String server = "http://" + host + ":3004/api/v1";
            assertEquals(server, ServerAddress.validate(server, true));
            assertThrows(IllegalArgumentException.class, () -> ServerAddress.validate(server, false));
        }
    }

    @Test public void debugRejectsRemoteAndDisguisedHttpHosts() {
        for (String host : new String[]{"192.168.1.2", "example.com", "localhost.example.com",
                "127.0.0.1.example.com", "localhost@example.com", "example.com@localhost", "127.1"}) {
            assertThrows(IllegalArgumentException.class,
                    () -> ServerAddress.validate("http://" + host + ":3004/api/v1", true));
        }
    }

    @Test public void rejectsCredentialsQueriesFragmentsAndWrongPaths() {
        for (String server : new String[]{"https://user@example.com/api/v1", "https://example.com/api/v1?q=1",
                "https://example.com/api/v1#token", "https://example.com/api", "file:///api/v1"}) {
            assertThrows(IllegalArgumentException.class, () -> ServerAddress.validate(server, true));
        }
    }
}
