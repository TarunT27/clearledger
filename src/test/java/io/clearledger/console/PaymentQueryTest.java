package io.clearledger.console;

import static org.assertj.core.api.Assertions.assertThat;

import io.clearledger.payment.PaymentStatus;
import io.clearledger.risk.RiskDecision;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class PaymentQueryTest {

    private PaymentQuery query(String sort, Sort.Direction direction) {
        return new PaymentQuery(null, null, null, null, null, false, sort, direction);
    }

    @Test
    void sortsOnlyByColumnsTheTableActuallyOffers() {
        assertThat(query("amountMinor", Sort.Direction.ASC).toSort())
                .isEqualTo(Sort.by(Sort.Direction.ASC, "amountMinor"));
        assertThat(query("riskScore", Sort.Direction.DESC).toSort())
                .isEqualTo(Sort.by(Sort.Direction.DESC, "riskScore"));
    }

    @Test
    void rejectsAnArbitrarySortColumnInsteadOfPassingItToTheDatabase() {
        assertThat(query("idempotencyKeyHash", Sort.Direction.ASC).toSort())
                .isEqualTo(Sort.by(Sort.Direction.ASC, "createdAt"));
        assertThat(query("'; drop table payments; --", Sort.Direction.ASC).toSort())
                .isEqualTo(Sort.by(Sort.Direction.ASC, "createdAt"));
        assertThat(query(null, null).toSort()).isEqualTo(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    @Test
    void carriesEveryFilterTheConsoleOffers() {
        PaymentQuery filtered =
                new PaymentQuery(
                        "northstar",
                        PaymentStatus.REVIEW,
                        RiskDecision.REVIEW,
                        "UNUSUAL_AMOUNT",
                        null,
                        true,
                        "createdAt",
                        Sort.Direction.DESC);

        assertThat(filtered.text()).isEqualTo("northstar");
        assertThat(filtered.status()).isEqualTo(PaymentStatus.REVIEW);
        assertThat(filtered.riskDecision()).isEqualTo(RiskDecision.REVIEW);
        assertThat(filtered.signal()).isEqualTo("UNUSUAL_AMOUNT");
        assertThat(filtered.exceptionsOnly()).isTrue();
        assertThat(filtered.toSpecification(java.util.Set.of())).isNotNull();
    }
}
