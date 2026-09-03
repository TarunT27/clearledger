package io.clearledger.local;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

/**
 * Runs a real PostgreSQL 17 server inside the JVM process for local development.
 *
 * <p>ClearLedger depends on PostgreSQL semantics that no in-memory substitute provides —
 * {@code FOR UPDATE SKIP LOCKED}, {@code ON CONFLICT}, regex check constraints — so the
 * alternative to a container was to test against a database that behaves differently from
 * production. This starts the genuine article instead, which means {@code ./mvnw -Plocal
 * spring-boot:run} needs no Docker daemon and still exercises exactly the schema and the
 * locking behaviour that Compose runs.
 *
 * <p>This source directory is compiled only under the {@code local} Maven profile, so
 * neither the dependency nor this class reaches the published container image.
 */
@Configuration
@Profile("local")
public class EmbeddedPostgresConfiguration {
    private static final Logger log =
            LoggerFactory.getLogger(EmbeddedPostgresConfiguration.class);

    @Bean(destroyMethod = "close")
    EmbeddedPostgres embeddedPostgres(
            @Value("${clearledger.local.postgres-port:0}") int port) throws IOException {
        EmbeddedPostgres postgres = EmbeddedPostgres.builder().setPort(port).start();
        log.info("Embedded PostgreSQL listening on port {}", postgres.getPort());
        return postgres;
    }

    @Bean
    @Primary
    DataSource dataSource(EmbeddedPostgres postgres) {
        return postgres.getPostgresDatabase();
    }
}
