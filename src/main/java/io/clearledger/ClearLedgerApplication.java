package io.clearledger;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ClearLedgerApplication {

	public static void main(String[] args) {
		SpringApplication.run(ClearLedgerApplication.class, args);
	}

}
