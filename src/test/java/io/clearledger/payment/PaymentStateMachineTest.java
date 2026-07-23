package io.clearledger.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class PaymentStateMachineTest {

    @ParameterizedTest
    @EnumSource(
            value = PaymentStatus.class,
            names = {"APPROVED", "REVIEW", "REJECTED"})
    void permitsPendingToReachAnyTerminalStatus(PaymentStatus terminalStatus) {
        assertThat(PaymentStateMachine.transition(PaymentStatus.PENDING, terminalStatus))
                .isEqualTo(terminalStatus);
    }

    @ParameterizedTest
    @EnumSource(
            value = PaymentStatus.class,
            names = {"APPROVED", "REVIEW", "REJECTED"})
    void terminalStatusCannotRegress(PaymentStatus terminalStatus) {
        assertThatIllegalStateException()
                .isThrownBy(
                        () ->
                                PaymentStateMachine.transition(
                                        terminalStatus, PaymentStatus.PENDING));
    }
}
