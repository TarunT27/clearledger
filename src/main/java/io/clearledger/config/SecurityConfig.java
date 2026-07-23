package io.clearledger.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            org.springframework.security.config.annotation.web.builders.HttpSecurity http,
            @Value("${clearledger.demo.enabled:false}") boolean demoEnabled)
            throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .httpBasic(Customizer.withDefaults())
                .sessionManagement(
                        sessions ->
                                sessions.sessionCreationPolicy(
                                        SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(
                        requests -> {
                            requests.requestMatchers("/actuator/health/**").permitAll();
                            requests.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                            if (demoEnabled) {
                                requests.anyRequest().permitAll();
                            } else {
                                requests
                                        .requestMatchers(
                                                "/actuator/info",
                                                "/actuator/metrics/**",
                                                "/actuator/prometheus",
                                                "/api/v1/reconciliation/**")
                                        .hasRole("OPS")
                                        .anyRequest()
                                        .authenticated();
                            }
                        })
                .build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${clearledger.cors.allowed-origins}") String allowedOrigins) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(
                Arrays.stream(allowedOrigins.split(",")).map(String::strip).toList());
        configuration.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
        configuration.setAllowedHeaders(
                List.of(
                        "Content-Type",
                        "Idempotency-Key",
                        "X-Correlation-Id",
                        "X-ClearLedger-Request"));
        configuration.setExposedHeaders(
                List.of("Location", "X-Correlation-Id", "Retry-After"));
        configuration.setAllowCredentials(false);
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}
