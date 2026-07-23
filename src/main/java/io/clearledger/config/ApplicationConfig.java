package io.clearledger.config;

import io.clearledger.ledger.JournalVerifier;
import io.clearledger.reconciliation.ReconciliationPlanner;
import io.clearledger.risk.RiskEngine;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ApplicationConfig {
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    RiskEngine riskEngine() {
        return new RiskEngine();
    }

    @Bean
    JournalVerifier journalVerifier() {
        return new JournalVerifier();
    }

    @Bean
    ReconciliationPlanner reconciliationPlanner() {
        return new ReconciliationPlanner();
    }
}
