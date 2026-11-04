package vn.lichgiadinh.screentime;

import org.junit.Test;
import static org.junit.Assert.*;

public class PairingCodeTest {
    @Test public void normalizesCopiedLowercaseAndWhitespace() {
        assertEquals("A1B2C3D4E5F0", PairingCode.validate(" a1b2\u00a0c3d4 e5f0\n"));
    }

    @Test public void identifiesMissingAndIncompleteCodes() {
        assertTrue(assertThrows(IllegalArgumentException.class, () -> PairingCode.validate(" ")).getMessage().contains("Hãy nhập"));
        assertTrue(assertThrows(IllegalArgumentException.class, () -> PairingCode.validate("123")).getMessage().contains("hiện có 3"));
        assertThrows(IllegalArgumentException.class, () -> PairingCode.validate("A1B2C3D4E5F01"));
    }

    @Test public void doesNotSilentlyReplaceConfusableLetters() {
        assertTrue(assertThrows(IllegalArgumentException.class, () -> PairingCode.validate("A1B2C3D4E5FO")).getMessage().contains("chữ O"));
        assertThrows(IllegalArgumentException.class, () -> PairingCode.validate("A1B2C3D4E5F-"));
    }
}
